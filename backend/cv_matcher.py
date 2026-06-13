import re
from typing import Dict, List, Optional

try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    SentenceTransformer = None
    cosine_similarity = None

_EMBEDDING_MODEL = None


def _load_embedding_model():
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is None:
        if SentenceTransformer is None:
            raise RuntimeError("sentence-transformers is required for CV matching")
        _EMBEDDING_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _EMBEDDING_MODEL


def _compute_ml_similarity(cv_text: str, job_text: str) -> float:
    if not cv_text or not job_text:
        return 0.0
    try:
        model = _load_embedding_model()
        embeddings = model.encode([cv_text, job_text], normalize_embeddings=True)
        if len(embeddings) != 2:
            return 0.0
        cv_emb, job_emb = embeddings
        if cosine_similarity is not None:
            similarity = float(cosine_similarity([cv_emb], [job_emb])[0][0])
        else:
            dot = sum(a * b for a, b in zip(cv_emb, job_emb))
            norm = (sum(a * a for a in cv_emb) ** 0.5) * (sum(b * b for b in job_emb) ** 0.5)
            similarity = dot / norm if norm else 0.0
        return max(0.0, min(1.0, similarity))
    except Exception:
        return 0.0


_FIELD_ALIASES = {
    "computer science": ["cs", "bscs", "bs cs", "software engineering", "se", "it"],
    "medical": ["mbbs", "medicine", "clinical", "hospital", "patient care"],
    "marketing": ["seo", "digital marketing", "social media", "campaign"],
    "finance": ["accounting", "banking", "audit", "financial analysis"],
}


def _normalize_text(text: str) -> str:
    return (text or "").lower()


def _find_terms(text: str, terms: List[str]) -> List[str]:
    found: List[str] = []
    for term in terms:
        if not term or not term.strip():
            continue
        term = term.strip()
        escaped = re.escape(term)
        if term.lower() in {"cs", "se", "it"} or len(term) <= 2:
            pattern = rf"\b{escaped}\b"
        else:
            pattern = rf"\b{escaped}\b"
        if re.search(pattern, text, flags=re.I):
            found.append(term)
    return found


def _tokenize_text(text: str) -> List[str]:
    return re.findall(r"\b[a-z]{3,}\b", text.lower())


def _word_match_ratio(text: str, phrases: List[str]) -> float:
    if not phrases:
        return 0.0
    text_words = set(_tokenize_text(text))
    match_count = 0
    total = 0
    for phrase in phrases:
        words = [w for w in re.findall(r"\b[a-z]{3,}\b", phrase.lower()) if w]
        if not words:
            continue
        total += len(words)
        match_count += sum(1 for word in words if word in text_words)
    return match_count / total if total else 0.0


def _match_field_aliases(text: str, field_value: Optional[str]) -> List[str]:
    aliases_found: List[str] = []
    if not field_value:
        return aliases_found
    normalized_field = field_value.lower().strip()
    candidates = []
    for canonical, aliases in _FIELD_ALIASES.items():
        if normalized_field == canonical or normalized_field in aliases:
            candidates = [canonical] + aliases
            break
    if not candidates:
        candidates = [normalized_field]
    for alias in candidates:
        escaped = re.escape(alias)
        if re.search(rf"\b{escaped}\b", text, flags=re.I):
            aliases_found.append(alias)
    return list(dict.fromkeys(aliases_found))


def _build_phrase_hits(text: str, phrase: str) -> bool:
    phrase = phrase.strip()
    if not phrase:
        return False
    if len(phrase.split()) == 1:
        return bool(re.search(rf"\b{re.escape(phrase)}\b", text, flags=re.I))
    return bool(re.search(rf"\b{re.escape(phrase)}\b", text, flags=re.I))


def analyze_cv_against_job(cv_text: str, job: dict) -> Dict:
    text = _normalize_text(cv_text)
    title = (job.get("title") or "")
    description = (job.get("description") or "")
    field = (job.get("field") or "")
    skills_keywords = list(job.get("skills_keywords") or [])
    required_keywords = list(job.get("required_keywords") or [])
    preferred_keywords = list(job.get("preferred_keywords") or [])

    matched_required_keywords = _find_terms(text, required_keywords)
    missing_required_keywords = [term for term in required_keywords if term not in matched_required_keywords]
    matched_preferred_keywords = _find_terms(text, preferred_keywords)
    matched_skills = _find_terms(text, skills_keywords)
    field_aliases_found = _match_field_aliases(text, field)

    title_score = _word_match_ratio(text, [title]) if title else 0.0
    description_score = _word_match_ratio(text, [description]) if description else 0.0
    title_desc_score = (title_score + description_score) / 2.0 if (title or description) else 0.0

    required_score = len(matched_required_keywords) / len(required_keywords) if required_keywords else 0.0
    preferred_score = len(matched_preferred_keywords) / len(preferred_keywords) if preferred_keywords else 0.0
    skills_score = len(matched_skills) / len(skills_keywords) if skills_keywords else 0.0
    field_score = 1.0 if field_aliases_found else 0.0

    # Redistribute missing category weights when lists are absent.
    weights = {
        "required": 35,
        "preferred": 15,
        "skills": 20,
        "field": 15,
        "title_desc": 15,
    }
    if not required_keywords:
        weights["required"] = 0
        weights["title_desc"] += 35
    if not preferred_keywords:
        weights["preferred"] = 0
        weights["skills"] += 15
    if not skills_keywords:
        weights["skills"] = 0
        weights["title_desc"] += 20
    if not field:
        weights["field"] = 0
        weights["title_desc"] += 15

    score = round(
        weights["required"] * required_score
        + weights["preferred"] * preferred_score
        + weights["skills"] * skills_score
        + weights["field"] * field_score
        + weights["title_desc"] * title_desc_score
    )
    score = max(0, min(100, score))

    job_text = " ".join(
        [title, description, field]
        + skills_keywords
        + required_keywords
        + preferred_keywords
    ).strip()
    ml_similarity_score = round(min(_compute_ml_similarity(text, job_text), 1.0) * 100)
    if job_text:
        final_score = round(score * 0.6 + ml_similarity_score * 0.4)
    else:
        final_score = score
    final_score = max(0, min(100, final_score))

    if final_score >= 70:
        status = "Relevant CV"
    elif final_score >= 45:
        status = "Needs Manual Review"
    else:
        status = "Irrelevant or Unusual CV"

    issues: List[str] = []
    criteria_present = any([title, description, field, skills_keywords, required_keywords, preferred_keywords])
    if not criteria_present:
        issues.append("Job posting contains no matching criteria")
    if final_score < 45 and not field_aliases_found and not matched_required_keywords and not matched_preferred_keywords and not matched_skills:
        issues.append("CV did not match any key job terms or skills")

    return {
        "score": final_score,
        "rule_score": score,
        "ml_similarity_score": ml_similarity_score,
        "final_score": final_score,
        "status": status,
        "show_to_recruiter": final_score >= 45,
        "matched_required_keywords": matched_required_keywords,
        "matched_preferred_keywords": matched_preferred_keywords,
        "missing_required_keywords": missing_required_keywords,
        "field_aliases_found": field_aliases_found,
        "issues": issues,
        "word_count": len(re.findall(r"\w+", cv_text or "")),
    }
