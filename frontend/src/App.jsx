import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { API_BASE, mapMeToUser, initials, toFrontendPost } from "./utils";
import {
  INTERESTS,
  COUNTRIES,
  MAJORS,
  DEGREES,
  RECRUITER_ROLES,
  INDUSTRIES,
  COMPANY_SIZES,
  SPECIALIZED_BOTS,
  SEED_NEWS,
  SEED_POSTS,
  POST_TAGS
} from "../constants";

const ADMIN_EMAIL = "admin@schlr.com";
const RECRUITER_POST_TAGS = ["Internship open", "Experience", "Question", "Tip"];

export function FeedIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-feed ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="megaphone-body" d="M11.6 16.8L6.8 14H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.8l4.8-2.8A1 1 0 0 1 13 4v12a1 1 0 0 1-1.4.8z" />
      <path className="megaphone-handle" d="M9 14v5a2 2 0 0 1-2 2H6.5" />
      <path className="megaphone-wave-1" d="M17.5 7.5a6 6 0 0 1 0 9" />
      <path className="megaphone-wave-2" d="M20.5 4.5a11 11 0 0 1 0 15" />
    </svg>
  );
}

export function JobsIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-jobs ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <rect className="briefcase-body" x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path className="briefcase-handle" d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <line className="briefcase-line" x1="2" y1="12" x2="22" y2="12" />
      <circle className="briefcase-lock" cx="12" cy="12" r="1.5" />
    </svg>
  );
}

export function MatchesIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-matches ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <circle className="target-outer" cx="12" cy="12" r="10" />
      <circle className="target-inner" cx="12" cy="12" r="6" />
      <circle className="target-center" cx="12" cy="12" r="2" />
      <path className="target-cross-h" d="M12 2v4M12 18v4" />
      <path className="target-cross-v" d="M2 12h4M18 12h4" />
    </svg>
  );
}

export function ChatIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-chat ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <rect className="robot-head" x="3" y="6" width="18" height="13" rx="3.5" />
      <path className="robot-antenna" d="M12 6V2" />
      <circle className="robot-antenna-tip" cx="12" cy="2" r="1" />
      <line className="robot-eye-left" x1="8" y1="11" x2="10" y2="11" />
      <line className="robot-eye-right" x1="14" y1="11" x2="16" y2="11" />
      <path className="robot-mouth" d="M9 15h6" />
      <path className="robot-ear-l" d="M3 11H2" />
      <path className="robot-ear-r" d="M21 11h-1" />
    </svg>
  );
}

export function GuidesIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-guides ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="book-page-l" d="M2 3h10v16H2z" />
      <path className="book-page-r" d="M12 3h10v16H12z" />
      <path className="book-spine" d="M12 3v16" />
      <path className="book-lines-l" d="M6 7h3M6 11h3M6 15h3" />
      <path className="book-lines-r" d="M15 7h3M15 11h3M15 15h3" />
    </svg>
  );
}

export function MessagesIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-messages ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="message-bubble" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <circle className="message-dot-1" cx="8" cy="12" r="1.2" fill="currentColor" />
      <circle className="message-dot-2" cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle className="message-dot-3" cx="16" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function ProfileIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-profile ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="profile-head" d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path className="profile-body" d="M18 21a6 6 0 0 0-12 0" />
      <circle className="profile-border" cx="12" cy="12" r="11" strokeDasharray="3 3" strokeWidth="1" opacity="0" />
    </svg>
  );
}

export function OverviewIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-overview ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <line className="chart-axis" x1="18" y1="20" x2="6" y2="20" />
      <line className="chart-bar-1" x1="6" y1="20" x2="6" y2="14" strokeWidth="2.5" />
      <line className="chart-bar-2" x1="10" y1="20" x2="10" y2="8" strokeWidth="2.5" />
      <line className="chart-bar-3" x1="14" y1="20" x2="14" y2="12" strokeWidth="2.5" />
      <line className="chart-bar-4" x1="18" y1="20" x2="18" y2="5" strokeWidth="2.5" />
    </svg>
  );
}

export function ApplicantsIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-applicants ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="applicants-user1-head" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle className="applicants-user1-face" cx="9" cy="7" r="4" />
      <path className="applicants-user2-head" d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path className="applicants-user2-face" d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function ApprovalsIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-approvals ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="shield-body" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path className="shield-check" d="M9 11l2 2 4-4" />
    </svg>
  );
}

export function AnalyticsIcon({ className = "", width = "18", height = "18", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-analytics ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="trend-line" d="M3 3v18h18" />
      <path className="trend-arrow" d="M18.7 8l-5.1 5.2-2.8-2.7-4.8 4.8" />
      <path className="trend-arrowhead" d="M14 8h5v5" />
    </svg>
  );
}

export function SettingsIcon({ className = "", width = "16", height = "16", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-settings ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <circle className="gear-center" cx="12" cy="12" r="3" />
      <path className="gear-teeth" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function LogoutIcon({ className = "", width = "16", height = "16", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-logout ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="logout-door" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline className="logout-arrow-head" points="16 17 21 12 16 7" />
      <line className="logout-arrow-line" x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function SunIcon({ className = "", width = "14", height = "14", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-sun ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function MoonIcon({ className = "", width = "14", height = "14", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-moon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function CoffeeIcon({ className = "", width = "14", height = "14", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-coffee ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="coffee-cup" d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <path className="coffee-steam-1" d="M6 5c.5-1.5-.5-2.5 0-4" />
      <path className="coffee-steam-2" d="M10 5c.5-1.5-.5-2.5 0-4" />
      <path className="coffee-steam-3" d="M14 5c.5-1.5-.5-2.5 0-4" />
    </svg>
  );
}

export function LightningIcon({ className = "", width = "14", height = "14", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-lightning ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function UserIcon({ className = "", width = "14", height = "14", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-user ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="user-head" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle className="user-face" cx="12" cy="7" r="4" />
    </svg>
  );
}

export function SettingsLockIcon({ className = "", width = "14", height = "14", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-lock ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <rect className="lock-body" x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path className="lock-shackle" d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function WarningIcon({ className = "", width = "14", height = "14", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-warning ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path className="warning-triangle" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line className="warning-line" x1="12" y1="9" x2="12" y2="13" />
      <circle className="warning-dot" cx="12" cy="17" r="0.75" />
    </svg>
  );
}

export function InstagramIcon({ className = "", width = "16", height = "16", strokeWidth = "2.2" }) {
  return (
    <svg className={`svg-nav-icon svg-icon-instagram ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function GooeyLoader({ size = "medium", text = "" }) {
  const sizeClass = size === "small" ? "loader-sm" : size === "large" ? "loader-lg" : "loader-md";
  
  return (
    <div className="gooey-loader-wrapper animate-fade-in">
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={{ display: "none" }}>
        <defs>
          <filter id="gooey-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="gooey" />
            <feBlend in="SourceGraphic" in2="gooey" />
          </filter>
        </defs>
      </svg>
      <div className={`gooey-loader-container ${sizeClass}`}>
        <div className="gooey-center" />
        <div className="gooey-dot gooey-orbit-1" />
        <div className="gooey-dot gooey-orbit-2" />
        <div className="gooey-dot gooey-orbit-3" />
        <div className="gooey-dot gooey-orbit-4" />
      </div>
      {text && <div className="gooey-loader-text">{text}</div>}
    </div>
  );
}

// ==========================================
// 1. INTERACTIVE SVG ANIMATED ICONS
// ==========================================

export function FingerprintIcon() {
  return (
    <svg viewBox="0 0 100 100" className="icon-fingerprint">
      <path d="M30 70 C 30 50, 40 40, 50 40 C 60 40, 70 50, 70 70" />
      <path d="M25 70 C 25 40, 35 30, 50 30 C 65 30, 75 40, 75 70" />
      <path d="M20 70 C 20 30, 30 20, 50 20 C 70 20, 80 30, 80 70" />
      <path d="M35 70 C 35 55, 42 48, 50 48 C 58 48, 65 55, 65 70" />
      <path d="M40 70 C 40 60, 45 56, 50 56 C 55 56, 60 60, 60 70" />
      <path d="M45 70 C 45 66, 48 64, 50 64 C 52 64, 55 66, 55 70" />
      <line x1="15" y1="5" x2="85" y2="5" className="icon-fingerprint-laser" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 100 100" className="icon-shield">
      <circle cx="50" cy="50" r="45" className="icon-shield-ring" strokeDasharray="6 6" />
      <path d="M50 15 L80 25 V50 C80 68, 68 82, 50 88 C32 82, 20 68, 20 50 V25 L50 15 Z" />
      <path d="M38 52 L46 60 L62 40" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 100 100" className="icon-lock">
      <path d="M30 45 V30 C30 18, 38 10, 50 10 C62 10, 70 18, 70 30 V45" className="icon-lock-shackle" />
      <rect x="20" y="45" width="60" height="45" rx="12" />
      <circle cx="50" cy="65" r="6" />
      <line x1="50" y1="71" x2="50" y2="80" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg viewBox="0 0 100 100" className="icon-key">
      <circle cx="30" cy="50" r="18" />
      <circle cx="30" cy="50" r="6" />
      <line x1="48" y1="50" x2="85" y2="50" />
      <line x1="70" y1="50" x2="70" y2="65" />
      <line x1="80" y1="50" x2="80" y2="65" />
    </svg>
  );
}

export function EyeIcon({ open, onClick }) {
  return (
    <svg viewBox="0 0 24 24" className="icon-eye" onClick={onClick}>
      {open ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  );
}

// ==========================================
// 2. INLINED COMPONENTS
// ==========================================

export function MiniPost({ post, onUnsave }) {
  const text = post.text || "";
  const tag = post.tag || "";
  const img = post.imageUrl || post.image_url || "";
  const name = post.author_name || post.name || "";
  const handle = post.handle || "";

  return (
    <div className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, flexShrink: 0 }}>
          {initials(name || handle || "U")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>{name || handle || "Member"}</div>
              {handle && <div style={{ fontSize: 12, color: "var(--muted)" }}>@{handle}</div>}
            </div>
            {onUnsave && (
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: "4px 8px", fontSize: 11, borderRadius: 8, color: "var(--brown3)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onUnsave(post.id);
                }}
              >
                Unsave
              </button>
            )}
          </div>
          {tag && <span className="tag" style={{ marginTop: 6, display: "inline-block" }}>{tag}</span>}
          <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 10, whiteSpace: "pre-wrap", color: "var(--text)" }}>{text}</p>
          {img && (
            <img
              src={img}
              alt=""
              style={{ marginTop: 10, maxWidth: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. LANDING PAGE
// ==========================================

export function LandingPage({ onChoose }) {
  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "var(--cream)", 
      color: "var(--text)", 
      fontFamily: "var(--font-sans)", 
      position: "relative",
      overflowX: "hidden",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Decorative Background Orbs */}
      <div className="bg-orb bg-orb-1" style={{ opacity: 0.12 }} />
      <div className="bg-orb bg-orb-2" style={{ opacity: 0.12 }} />
      <div className="bg-orb bg-orb-3" style={{ opacity: 0.12 }} />

      {/* Top Navbar */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 40px",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brown4)", fontFamily: "var(--font-display)", letterSpacing: "1px" }}>
          SCHLR
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-ghost" style={{ padding: "8px 20px" }} onClick={() => onChoose("login")}>Sign In</button>
          <button className="btn-primary" style={{ padding: "8px 20px" }} onClick={() => onChoose("signup")}>Get Started</button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ 
        flex: 1, 
        width: "100%", 
        maxWidth: 1200, 
        margin: "0 auto", 
        padding: "40px 20px", 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "center", 
        gap: 60,
        zIndex: 10
      }}>
        
        {/* Hero Grid Section */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1.2fr 1fr", 
          gap: 40, 
          alignItems: "center",
          minHeight: "60vh"
        }} className="landing-hero-grid">
          
          {/* Hero Left Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="animate-hero-left">
            <div style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: 8, 
              padding: "6px 14px", 
              borderRadius: "30px", 
              background: "var(--accent-bg)", 
              border: "1px solid var(--accent-border)",
              color: "var(--brown3)",
              fontSize: 13,
              fontWeight: 600,
              alignSelf: "flex-start"
            }}>
              <span>🌟</span> AI-Powered Academic Network
            </div>
            
            <h1 style={{ 
              fontSize: "clamp(32px, 5vw, 48px)", 
              fontWeight: 850, 
              color: "var(--text-h)", 
              lineHeight: 1.15,
              fontFamily: "var(--font-display)",
              margin: 0
            }}>
              Your Academic Journey, <br />
              <span style={{ color: "var(--brown3)", background: "linear-gradient(120deg, var(--brown2), var(--brown3))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Amplified by AI.</span>
            </h1>
            
            <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.6, margin: 0, maxWidth: 540 }}>
              The all-in-one community platform for students. Discover scholarships and internships matched to your CV, brainstorm with specialized AI career advisors, and network with a global community of peers and recruiters.
            </p>
            
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
              <button className="btn-primary" style={{ padding: "14px 28px", fontSize: 15 }} onClick={() => onChoose("signup")}>
                Explore Opportunities
              </button>
              <button className="btn-ghost" style={{ padding: "14px 28px", fontSize: 15 }} onClick={() => onChoose("login")}>
                Access Dashboard
              </button>
            </div>

            {/* Metrics Row */}
            <div style={{ display: "flex", gap: 40, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brown4)" }}>10k+</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Active Opportunities</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brown4)" }}>98%</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>AI Match Accuracy</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brown4)" }}>24/7</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>AI Career Support</div>
              </div>
            </div>
          </div>

          {/* Hero Right Preview Mockup */}
          <div className="animate-fade-in" style={{ display: "flex", justifyContent: "center" }}>
            <div className="glass-panel" style={{ 
              width: "100%", 
              maxWidth: 440, 
              padding: 24, 
              borderRadius: 24,
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              background: "var(--white)",
              position: "relative"
            }}>
              
              {/* Mini Recommendation Mock Card */}
              <div className="card-match" style={{ 
                background: "var(--white-solid)", 
                padding: 16, 
                borderRadius: 16, 
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brown3)", letterSpacing: "0.5px" }}>RECOMMENDED MATCH</span>
                  <span style={{ padding: "4px 8px", background: "var(--accent-bg)", borderRadius: 20, color: "var(--brown3)", fontSize: 11, fontWeight: 700 }}>96% Match</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-h)" }}>Global Tech Excellence Scholarship</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>TechCorp Foundation • United States</div>
              </div>

              {/* Mini AI Advisor Mock Card */}
              <div className="card-advisor" style={{ 
                background: "var(--white-solid)", 
                padding: 16, 
                borderRadius: 16, 
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow)",
                alignSelf: "flex-end",
                width: "90%"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>🤖</span>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brown4)" }}>AI Essay Advisor</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4, background: "var(--cream)", padding: "10px 12px", borderRadius: "10px 10px 0 10px" }}>
                  "I reviewed your Statement of Purpose. Let's strengthen your opening sentence to highlight your research experience."
                </div>
              </div>

              {/* Mini Post Mock Card */}
              <div className="card-post" style={{ 
                background: "var(--white-solid)", 
                padding: 16, 
                borderRadius: 16, 
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow)",
                width: "95%"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--brown2)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold" }}>A</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-h)" }}>Aria Chen</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Student at MIT</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>
                  "Just finished uploading my CV and got matched to a Software Engineering Internship! 🙌"
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                  <span>❤️ 24 likes</span>
                  <span>💬 5 comments</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Website Capabilities Grid */}
        <div>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-h)", fontFamily: "var(--font-display)" }}>
              What is SCHLR Capable of?
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 16, maxWidth: 600, margin: "8px auto 0" }}>
              Explore the core capabilities that help you succeed in your academic and professional path.
            </p>
          </div>

          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
            gap: 24 
          }}>
            
            {/* Capability 1 */}
            <div className="glass-panel" style={{ padding: 28, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14, background: "var(--white)", transition: "transform 0.2s ease" }}>
              <div style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
                <MatchesIcon width="36" height="36" strokeWidth="2.2" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-h)", margin: 0 }}>Smart Matchmaking</h3>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
                Upload your CV and set your parameters. Our scoring engine matches you with scholarships and internships aligned with your major, target destination, and academic background.
              </p>
            </div>

            {/* Capability 2 */}
            <div className="glass-panel" style={{ padding: 28, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14, background: "var(--white)", transition: "transform 0.2s ease" }}>
              <div style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
                <ChatIcon width="36" height="36" strokeWidth="2.2" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-h)", margin: 0 }}>Specialized AI Chatbots</h3>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
                Consult AI advisors specialized in general college guidance, scholarship essay editing, and technical interview preparation. Refine your drafts and pitches instantly.
              </p>
            </div>

            {/* Capability 3 */}
            <div className="glass-panel" style={{ padding: 28, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14, background: "var(--white)", transition: "transform 0.2s ease" }}>
              <div style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
                <FeedIcon width="36" height="36" strokeWidth="2.2" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-h)", margin: 0 }}>Collaborative Social Feed</h3>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
                Interact with peers on the platform. Post updates, ask questions, comment, and share academic milestones to motivate and support each other.
              </p>
            </div>

            {/* Capability 4 */}
            <div className="glass-panel" style={{ padding: 28, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14, background: "var(--white)", transition: "transform 0.2s ease" }}>
              <div style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
                <MessagesIcon width="36" height="36" strokeWidth="2.2" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-h)", margin: 0 }}>Real-Time Messaging</h3>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
                Chat privately with other community members or directly with corporate recruiters. Create messaging threads, check online status, and build networking ties.
              </p>
            </div>

            {/* Capability 5 */}
            <div className="glass-panel" style={{ padding: 28, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14, background: "var(--white)", transition: "transform 0.2s ease" }}>
              <div style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
                <JobsIcon width="36" height="36" strokeWidth="2.2" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-h)", margin: 0 }}>Recruiter Dashboard</h3>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
                A dedicated interface for employers to post jobs and search for students based on CV match scoring. Direct application review streamlines the hiring process.
              </p>
            </div>

            {/* Capability 6 */}
            <div className="glass-panel" style={{ padding: 28, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14, background: "var(--white)", transition: "transform 0.2s ease" }}>
              <div style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
                <GuidesIcon width="36" height="36" strokeWidth="2.2" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-h)", margin: 0 }}>Curated Opportunities News</h3>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
                Keep track of academic opportunities with our integrated news feed, compiling articles and announcements about education and global scholarships.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* Footer */}
      <footer style={{
        marginTop: "auto",
        borderTop: "1px solid var(--border)",
        padding: "30px 40px",
        textAlign: "center",
        fontSize: 14,
        color: "var(--muted)",
        zIndex: 10
      }}>
        © 2026 SCHLR Scholarship Community.
        <a 
          href="https://www.instagram.com/alam_mahad" 
          target="_blank" 
          rel="noopener noreferrer"
          className="instagram-link"
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 6, 
            marginLeft: 8,
            color: "inherit",
            textDecoration: "none",
            verticalAlign: "middle",
            transition: "color 0.2s ease"
          }}
        >
          <InstagramIcon />
          <span>@alam_mahad</span>
        </a>
      </footer>
    </div>
  );
}

// ==========================================
// 4. AUTH PAGE
// ==========================================

export function AuthPage({ onLogin, onAuthToken, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    name:"", email:"", password:"", confirmPassword:"",
    university:"", degree:"", major:"", gpa:"",
    country:"", targetCountry:"", interests:[],
    userType:"student",
    recruiterTitle:"", industry:"", companySize:"", hiringFocus:[],
    companyWebsite:"", linkedinCompany:"",
  });

  useEffect(() => {
    setMode(initialMode);
    setStep(1);
    setError("");
  }, [initialMode]);

  const toggleInterest = (i) => {
    setForm(f=>({...f, interests: f.interests.includes(i) ? f.interests.filter(x=>x!==i) : [...f.interests,i]}));
  };
  const toggleHiringFocus = (i) => {
    setForm(f=>({...f, hiringFocus: f.hiringFocus.includes(i) ? f.hiringFocus.filter(x=>x!==i) : [...f.hiringFocus,i]}));
  };

  const handleSubmit = async () => {
    setError("");
    const normalizedEmail = form.email.trim().toLowerCase();
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    const strongPassRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!form.email.trim() || !form.password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && normalizedEmail === ADMIN_EMAIL) {
      setError("Admin account cannot be created here. Use the built-in admin credentials to log in.");
      return;
    }
    if (mode==="signup" && step===2) {
      if (form.userType==="recruiter") {
        if (!form.recruiterTitle.trim()) {
          setError("Your title or role at the organization is required.");
          return;
        }
        if (!form.industry.trim()) {
          setError("Industry is required for recruiter accounts.");
          return;
        }
      }
    }

    if (mode==="signup" && step===1) {
      if (!form.name.trim()) {
        setError("Full name is required.");
        return;
      }
      if (!strongPassRegex.test(form.password)) {
        setError("Password must be 8+ chars with uppercase, lowercase, number, and special character.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Password and confirm password do not match.");
        return;
      }
      setStep(2);
      return;
    }

    const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
    const payload = mode === "login"
      ? { email: normalizedEmail, password: form.password }
      : form.userType === "recruiter"
      ? {
          name: form.name,
          email: normalizedEmail,
          password: form.password,
          user_type: "recruiter",
          work_email: normalizedEmail,
          university: form.university,
          degree: form.degree || null,
          major: form.major || null,
          country: form.country || null,
          target_country: form.targetCountry || null,
          interests: form.interests,
          recruiter_title: form.recruiterTitle,
          industry: form.industry,
          company_size: form.companySize || null,
          hiring_focus: form.hiringFocus.length ? form.hiringFocus : form.interests,
          company_website: form.companyWebsite || null,
          linkedin_company_url: form.linkedinCompany || null,
        }
      : {
          name: form.name,
          email: normalizedEmail,
          password: form.password,
          user_type: "student",
          university: form.university,
          degree: form.degree,
          major: form.major,
          country: form.country,
          target_country: form.targetCountry,
          interests: form.interests,
        };

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Authentication failed");

      const token = data.token;
      const apiUser = data.user || {};
      const profile = apiUser.profile || {};
      onAuthToken(token);
      const mergedDoc = {
        ...apiUser,
        _id: apiUser.id || apiUser._id,
        user_type:
          apiUser.user_type ||
          (form.userType === "recruiter" ? "recruiter" : "student"),
        handle: apiUser.handle,
        name: apiUser.name || form.name,
        email: apiUser.email || form.email,
        profile: {
          ...(apiUser.profile || {}),
          work_email: profile.work_email || form.email,
          university: profile.university || form.university,
          major: profile.major || form.major,
          target_country: profile.target_country || form.targetCountry,
          interests: profile.interests?.length ? profile.interests : form.interests,
          degree: profile.degree || form.degree,
          country: profile.country || form.country,
          recruiter_title: profile.recruiter_title || form.recruiterTitle,
          industry: profile.industry || form.industry,
          company_size: profile.company_size || form.companySize,
          hiring_focus: profile.hiring_focus?.length ? profile.hiring_focus : form.hiringFocus,
          company_website: profile.company_website || form.companyWebsite,
          linkedin_company_url: profile.linkedin_company_url || form.linkedinCompany,
        },
      };
      onLogin(mapMeToUser(mergedDoc));
    } catch (err) {
      setError(err.message || "Unable to authenticate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      {/* Floating Academic Icons */}
      <div className="floating-decor-icon decor-1"><span>🎓</span><div>Learn</div></div>
      <div className="floating-decor-icon decor-2"><span>🏆</span><div>Achieve</div></div>
      <div className="floating-decor-icon decor-3"><span>💡</span><div>Inspire</div></div>
      <div className="floating-decor-icon decor-4"><span>📖</span><div>Read</div></div>
      <div className="floating-decor-icon decor-5"><span>🌐</span><div>Connect</div></div>

      <div className="glass-panel-lg animate-fade-in-up">
        <div className="auth-header">
          <button onClick={onBack} className="btn-ghost btn-sm">← Back</button>
          <div className="text-small text-muted text-bold">Secure Auth</div>
        </div>

        <div className="auth-title-section">
          {/* Animated Key Icon */}
          <div style={{ display: "inline-block", marginBottom: 8 }}><KeyIcon /></div>
          <h2 className="text-brand">SCHLR</h2>
          <div className="text-subtitle" style={{ fontSize: 10, marginTop: 2 }}>SCHOLARSHIP COMMUNITY</div>
        </div>

        {/* Tab selection */}
        <div className="sliding-nav-container" style={{ marginBottom: 24 }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setStep(1); setError(""); }}
              className={`sliding-nav-btn ${mode === m ? "active" : ""}`}
              style={{ flex: 1, textTransform: "capitalize" }}>
              {m}
            </button>
          ))}
        </div>

        {mode === "login" ? (
          <>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="input-icon-wrapper">
                <span className="input-icon">✉️</span>
                <input type="email" className="glass-input" style={{ paddingLeft: 40 }} placeholder="Email"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-icon-wrapper">
                <span className="input-icon">🔒</span>
                <input type={showPass ? "text" : "password"} className="glass-input" style={{ paddingLeft: 40, paddingRight: 40 }} placeholder="Password"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <span className="input-icon-right">
                  <EyeIcon open={showPass} onClick={() => setShowPass(!showPass)} />
                </span>
              </div>
            </div>

            <button disabled={loading} onClick={handleSubmit} className="btn-primary btn-full" style={{ marginTop: 12 }}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </>
        ) : step === 1 ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>I am a</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[["student", "Student 🎓"], ["recruiter", "Recruiter 💼"]].map(([v, l]) => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, userType: v }))}
                    className="btn-ghost"
                    style={{
                      flex: 1,
                      background: form.userType === v ? "var(--brown3)" : "rgba(255,255,255,0.4)",
                      color: form.userType === v ? "#fff" : "var(--text)",
                      border: form.userType === v ? "none" : "1px solid var(--border)"
                    }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {[
              ["Full Name", "name", "text", "👤"],
              form.userType === "recruiter" ? ["Work email", "email", "email", "✉️"] : ["Email", "email", "email", "✉️"],
              ["Password", "password", "password", "🔒"],
              ["Confirm Password", "confirmPassword", "password", "🔒"],
              ["University / Company", "university", "text", "🏛"]
            ].map(([lbl, name, type, icon]) => (
              <div key={name} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>{lbl}</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--muted)" }}>{icon}</span>
                  <input type={type === "password" && showPass ? "text" : type} className="glass-input" style={{ paddingLeft: 40, paddingRight: type === "password" ? 40 : 16 }} placeholder={lbl}
                    value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))} />
                  {type === "password" && (
                    <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
                      <EyeIcon open={showPass} onClick={() => setShowPass(!showPass)} />
                    </span>
                  )}
                </div>
              </div>
            ))}

            <button disabled={loading} onClick={handleSubmit} className="btn-primary" style={{ width: "100%", marginTop: 12 }}>
              Continue →
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 750, color: "var(--brown4)", marginBottom: 14, borderLeft: "4px solid var(--brown1)", paddingLeft: 8 }}>
              {form.userType === "recruiter" ? "Recruiter Profile" : "Scholarship Filter Prefs"}
            </div>
            
            <div style={{ maxHeight: 280, overflowY: "auto", paddingRight: 6, marginBottom: 16 }}>
              {form.userType === "recruiter" ? (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Your title / role</label>
                    <select className="glass-select" value={form.recruiterTitle} onChange={e=>setForm(f=>({...f,recruiterTitle:e.target.value}))}>
                      <option value="" disabled>Select your role...</option>
                      {RECRUITER_ROLES.map(r=>(<option key={r} value={r}>{r}</option>))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Industry</label>
                    <select className="glass-select" value={form.industry} onChange={e=>setForm(f=>({...f,industry:e.target.value}))}>
                      <option value="" disabled>Select industry...</option>
                      {INDUSTRIES.map(i=>(<option key={i} value={i}>{i}</option>))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Company size band</label>
                    <select className="glass-select" value={form.companySize} onChange={e=>setForm(f=>({...f,companySize:e.target.value}))}>
                      <option value="" disabled>Select company size...</option>
                      {COMPANY_SIZES.map(s=>(<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Company website</label>
                    <input type="url" className="glass-input" placeholder="https://"
                      value={form.companyWebsite} onChange={e=>setForm(f=>({...f,companyWebsite:e.target.value}))} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>LinkedIn company page</label>
                    <input type="url" className="glass-input" placeholder="https://www.linkedin.com/company/…"
                      value={form.linkedinCompany} onChange={e=>setForm(f=>({...f,linkedinCompany:e.target.value}))} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Hiring focus</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {["Internships","Software","Data","Product","Business","Research","Remote","Graduate hiring"].map(i=>(
                        <button key={i} type="button" onClick={()=>toggleHiringFocus(i)}
                          className="tag"
                          style={{
                            cursor: "pointer",
                            background: form.hiringFocus.includes(i) ? "var(--brown3)" : "var(--cream2)",
                            color: form.hiringFocus.includes(i) ? "#fff" : "var(--text)",
                          }}>
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Countries you recruit from (optional)</label>
                    <select className="glass-select" value={form.targetCountry} onChange={e=>setForm(f=>({...f,targetCountry:e.target.value}))}>
                      <option value="">Select country...</option>
                      {COUNTRIES.map(c=>(<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Degree Level</label>
                    <select className="glass-select" value={form.degree} onChange={e=>setForm(f=>({...f,degree:e.target.value}))}>
                      <option value="" disabled>Select degree level...</option>
                      {DEGREES.map(d=>(<option key={d} value={d}>{d}</option>))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Major / Field</label>
                    <select className="glass-select" value={form.major} onChange={e=>setForm(f=>({...f,major:e.target.value}))}>
                      <option value="" disabled>Select major...</option>
                      {MAJORS.map(m=>(<option key={m} value={m}>{m}</option>))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Current Country</label>
                    <select className="glass-select" value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value}))}>
                      <option value="" disabled>Select current country...</option>
                      {COUNTRIES.map(c=>(<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Target Study Country</label>
                    <select className="glass-select" value={form.targetCountry} onChange={e=>setForm(f=>({...f,targetCountry:e.target.value}))}>
                      <option value="" disabled>Select target study country...</option>
                      {COUNTRIES.map(c=>(<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>Scholarship Interests</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {INTERESTS.map(i=>(
                        <button key={i} type="button" onClick={()=>toggleInterest(i)}
                          className="tag"
                          style={{
                            cursor: "pointer",
                            background: form.interests.includes(i) ? "var(--brown3)" : "var(--cream2)",
                            color: form.interests.includes(i) ? "#fff" : "var(--text)"
                          }}>
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setStep(1)} className="btn-ghost" style={{ flex: 1 }}>← Back</button>
              <button type="button" disabled={loading} onClick={handleSubmit} className="btn-primary" style={{ flex: 2 }}>
                {loading ? "Creating Account..." : "Create Account 🎉"}
              </button>
            </div>
          </>
        )}

        {!!error && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--cream3)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--brown3)", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 5. NEWS & COMMUNITY SECTION
// ==========================================

export function NewsSection({ user, token, onPostsUpdated, feedVariant = "student", onViewUserProfile }) {
  const isRecruiterFeed = feedVariant === "recruiter";

  const [tab, setTab] = useState(isRecruiterFeed ? "community" : "news");
  const [posts, setPosts] = useState([]);
  const [postError, setPostError] = useState("");
  const [myJobs, setMyJobs] = useState([]);
  const [linkedJobId, setLinkedJobId] = useState("");
  const [applyBusy, setApplyBusy] = useState(null);
  const [applyMsg, setApplyMsg] = useState({});

  const auth = { Authorization: `Bearer ${token}` };

  const [savedMap, setSavedMap] = useState({});

  const loadSaved = useCallback(async () => {
    if (!token || feedVariant === "recruiter") return;
    try {
      const r = await fetch(`${API_BASE}/applications/me?status_filter=saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      const m = {};
      if (Array.isArray(d.items)) {
        d.items.forEach(app => {
          m[app.item_id] = app._id;
        });
      }
      setSavedMap(m);
    } catch (e) {
      console.error(e);
    }
  }, [token, feedVariant]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved, tab]);

  const toggleSave = async (itemId, itemType) => {
    const appId = savedMap[itemId];
    try {
      if (appId) {
        await fetch(`${API_BASE}/applications/${appId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        setSavedMap(prev => {
          const copy = { ...prev };
          delete copy[itemId];
          return copy;
        });
      } else {
        const r = await fetch(`${API_BASE}/applications`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: itemId, item_type: itemType, status: "saved" })
        });
        const d = await r.json();
        if (r.ok && d.id) {
          setSavedMap(prev => ({ ...prev, [itemId]: d.id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadPosts = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/posts`, { headers: auth });
      const data = await resp.json();
      const rawPosts = Array.isArray(data) ? data : data.posts || [];
      const mapped = rawPosts.map((p) => toFrontendPost(p, user.id));
      setPosts(mapped);
      onPostsUpdated?.(mapped);
    } catch {
      setPosts(SEED_POSTS);
      onPostsUpdated?.(SEED_POSTS);
    }
  }, [token, user.id, onPostsUpdated]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const [scrapedNews, setScrapedNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (tab !== "news" || isRecruiterFeed || !token) return;
    (async () => {
      setNewsLoading(true);
      try {
        const resp = await fetch(`${API_BASE}/news?limit=24`, { headers: auth });
        const data = await resp.json();
        const items = data.news || [];
        if (items.length > 0) {
          const mapped = items.map((item) => ({
            id:      item.id,
            site:    item.source || item.favicon || "News",
            favicon: item.favicon || "📰",
            time:    item.published_at
              ? new Date(item.published_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
              : "Recently",
            tag:     item.tag || "News",
            title:   item.title || "Untitled Article",
            snippet: item.summary || "Read more on the source website.",
            link:    item.url || "",
          }));
          setScrapedNews(mapped);
        } else {
          setScrapedNews([]);
        }
      } catch {
        setScrapedNews([]);
      } finally {
        setNewsLoading(false);
      }
    })();
  }, [tab, token, isRecruiterFeed]);

  useEffect(() => {
    if (!isRecruiterFeed || !token) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/recruiter/jobs/me`, { headers: auth });
        const d = await r.json().catch(() => ({}));
        setMyJobs(Array.isArray(d.jobs) ? d.jobs : []);
      } catch {
        setMyJobs([]);
      }
    })();
  }, [isRecruiterFeed, token]);

  const [newPost, setNewPost] = useState("");
  const [postTag, setPostTag] = useState(isRecruiterFeed ? "Internship open" : "Achievement");
  const [postImageFile, setPostImageFile] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [openComments, setOpenComments] = useState(null);
  const [commentInput, setCommentInput] = useState("");

  const likePost = async (id) => {
    setPostError("");
    const resp = await fetch(`${API_BASE}/posts/${id}/like`, { method: "POST", headers: auth });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setPostError(data.detail || "Unable to like post.");
      return;
    }
    loadPosts();
  };

  const savePost = async (id) => {
    setPostError("");
    const resp = await fetch(`${API_BASE}/posts/${id}/save`, { method: "POST", headers: auth });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setPostError(data.detail || "Unable to save post.");
      return;
    }
    loadPosts();
  };

  const deleteMyPost = async (id) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      const resp = await fetch(`${API_BASE}/posts/${id}`, {
        method: "DELETE",
        headers: auth
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to delete post.");
      }
      loadPosts();
    } catch (e) {
      setPostError(e.message || "Failed to delete post.");
    }
  };

  const uploadPostImageIfNeeded = async () => {
    if (!postImageFile) return null;
    setUploadingPic(true);
    try {
      const fd = new FormData();
      fd.append("file", postImageFile);
      const resp = await fetch(`${API_BASE}/upload/image?folder=posts`, {
        method: "POST",
        headers: auth,
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.detail || "Image upload failed");
      }
      return data.url || null;
    } finally {
      setUploadingPic(false);
    }
  };

  const submitPost = async () => {
    if (!newPost.trim() && !postImageFile) {
      setPostError("Please add text or attach an image.");
      return;
    }
    setPostError("");
    let imageUrl = null;
    try {
      imageUrl = await uploadPostImageIfNeeded();
    } catch (e) {
      setPostError(e.message || "Upload failed.");
      return;
    }
    const body = { text: newPost.trim(), tag: postTag };
    if (imageUrl) body.image_url = imageUrl;
    if (isRecruiterFeed && linkedJobId) body.job_posting_id = linkedJobId;

    const resp = await fetch(`${API_BASE}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setPostError(data.detail || "Unable to create post.");
      return;
    }
    setNewPost("");
    setLinkedJobId("");
    setPostImageFile(null);
    if (postImagePreview) URL.revokeObjectURL(postImagePreview);
    setPostImagePreview(null);
    loadPosts();
  };

  const onPickPostImage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (postImagePreview) URL.revokeObjectURL(postImagePreview);
    setPostImageFile(f);
    setPostImagePreview(URL.createObjectURL(f));
  };

  const addComment = async (id) => {
    if (!commentInput.trim()) return;
    setPostError("");
    const resp = await fetch(`${API_BASE}/posts/${id}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ text: commentInput }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setPostError(data.detail || "Unable to add comment.");
      return;
    }
    setCommentInput("");
    loadPosts();
  };

  const applyCvToLinkedJob = async (jobPostingId) => {
    if (user.userType !== "student") return;
    setApplyBusy(jobPostingId);
    setApplyMsg((m) => ({ ...m, [jobPostingId]: "" }));
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp";
      const picked = await new Promise((resolve) => {
        input.onchange = () => resolve(input.files?.[0] || null);
        input.click();
      });
      if (picked) {
        const fd = new FormData();
        fd.append("file", picked);
        fd.append("notes", "Applied via Community");
        const r = await fetch(`${API_BASE}/jobs/${jobPostingId}/apply-with-cv`, {
          method: "POST",
          headers: auth,
          body: fd,
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.detail || "Application failed.");
        setApplyMsg((m) => ({ ...m, [jobPostingId]: "Application submitted." }));
        return;
      }
      const cvUrl = (user.cvUrl || "").trim();
      if (!cvUrl) throw new Error("Add a résumé on your profile or choose a file when applying.");

      const r = await fetch(`${API_BASE}/applications`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: jobPostingId,
          item_type: "job_posting",
          status: "applied",
          cv_url: cvUrl,
          notes: "Applied via Community",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Application failed.");
      setApplyMsg((m) => ({ ...m, [jobPostingId]: "Application submitted." }));
    } catch (e) {
      setApplyMsg((m) => ({ ...m, [jobPostingId]: e.message || "Error" }));
    } finally {
      setApplyBusy(null);
    }
  };

  const applyWithSavedCv = async (jobPostingId) => {
    if (user.userType !== "student") return;
    const cvUrl = (user.cvUrl || "").trim();
    if (!cvUrl) {
      await applyCvToLinkedJob(jobPostingId);
      return;
    }
    setApplyBusy(jobPostingId);
    setApplyMsg((m) => ({ ...m, [jobPostingId]: "" }));
    try {
      const r = await fetch(`${API_BASE}/applications`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: jobPostingId,
          item_type: "job_posting",
          status: "applied",
          cv_url: cvUrl,
          notes: "Applied via Community",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Application failed.");
      setApplyMsg((m) => ({ ...m, [jobPostingId]: "Application submitted." }));
    } catch (e) {
      setApplyMsg((m) => ({ ...m, [jobPostingId]: e.message || "Error" }));
    } finally {
      setApplyBusy(null);
    }
  };

  const tagButtons = isRecruiterFeed ? RECRUITER_POST_TAGS : POST_TAGS;

  return (
    <div>
      {!isRecruiterFeed && (
        <div className="sliding-nav-container" style={{ width: "fit-content", marginBottom: 24 }}>
          {["news", "community"].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`sliding-nav-btn ${tab === t ? "active" : ""}`}>
              {t === "news" ? "📰 Latest News" : "🌐 Community"}
            </button>
          ))}
        </div>
      )}

      {isRecruiterFeed && (
        <div style={{ marginBottom: 20 }}>
          <h2>Community</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Share updates and optionally link one of your published roles so students can apply with a CV from the same thread.
          </p>
        </div>
      )}

      {tab === "news" && !isRecruiterFeed ? (
        <div>
          {newsLoading && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: 28, marginBottom: 10, animation: "spin 1.2s linear infinite", display: "inline-block" }}>🔄</div>
              <p style={{ fontSize: 14 }}>Fetching latest education news…</p>
            </div>
          )}
          {!newsLoading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              {((scrapedNews.length > 0) ? scrapedNews : SEED_NEWS).map((n) => (
                <div key={n.id} className="glass-panel glass-panel-hover" style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)" }}>
                        <span>{n.favicon}</span> {n.site}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{n.time}</span>
                    </div>
                    <span className="tag" style={{ marginBottom: 10 }}>{n.tag}</span>
                    <h3 style={{ fontSize: 16, color: "var(--brown4)", margin: "10px 0 8px", lineHeight: 1.4 }}>{n.title}</h3>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>{n.snippet}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                    {n.link ? (
                      <a href={n.link} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display: "inline-block", textDecoration: "none", padding: "6px 12px", fontSize: 12 }}>
                        Read more →
                      </a>
                    ) : (
                      <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>Read more →</button>
                    )}
                    {user?.userType === "student" && (
                      <button
                        type="button"
                        onClick={() => toggleSave(n.id, "scholarship")}
                        className="btn-ghost"
                        style={{ padding: "6px 12px", fontSize: 12, color: savedMap[n.id] ? "var(--brown3)" : "var(--muted)", borderRadius: 8 }}
                      >
                        {savedMap[n.id] ? "✓ Saved" : "Save"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {!!postError && (
            <div style={{ marginBottom: 16, padding: "10px 12px", background: "var(--cream3)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--brown3)", fontSize: 13 }}>
              {postError}
            </div>
          )}
          
          <div className="glass-panel" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div className="avatar" style={{ width: 40, height: 40, fontSize: 14 }}>{initials(user.name || "U")}</div>
              <div style={{ flex: 1 }}>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={isRecruiterFeed ? "Highlight your role, team, or how candidates should think..." : "Share a scholarship tip, achievement, or question…"}
                  rows={3}
                  className="glass-input"
                  style={{ resize: "none" }}
                />
                
                {isRecruiterFeed && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--brown3)", display: "block", marginBottom: 6 }}>Link published job / internship (optional)</label>
                    <select value={linkedJobId} onChange={(e) => setLinkedJobId(e.target.value)} className="glass-select" style={{ maxWidth: 420 }}>
                      <option value="">— No job linked —</option>
                      {myJobs.filter((j) => j.status === "active" || j.status == null).map((j) => (
                        <option key={j._id} value={j._id}>{j.title} ({j.employment_type})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                  <label className="btn-ghost" style={{ fontSize: 12, padding: "8px 14px", cursor: "pointer" }}>
                    📷 Attach photo
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={onPickPostImage} />
                  </label>
                  {postImagePreview && (
                    <div style={{ position: "relative" }}>
                      <img src={postImagePreview} alt="" style={{ maxHeight: 100, borderRadius: 10, border: "1px solid var(--border)" }} />
                      <button type="button" onClick={() => { setPostImageFile(null); URL.revokeObjectURL(postImagePreview); setPostImagePreview(null); }}
                        style={{ marginLeft: 8, fontSize: 12, color: "var(--brown3)", background: "none", border: "none", cursor: "pointer" }}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {tagButtons.map((t) => (
                      <button key={t} type="button" onClick={() => setPostTag(t)}
                        className="tag"
                        style={{
                          cursor: "pointer",
                          background: postTag === t ? "var(--brown3)" : "var(--cream2)",
                          color: postTag === t ? "#fff" : "var(--text)"
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <button onClick={submitPost} disabled={uploadingPic} className="btn-primary" style={{ padding: "9px 22px" }}>
                    {uploadingPic ? "Uploading…" : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {posts.map((post) => (
            <div key={post.id} className="card-post">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="avatar" onClick={() => post.user_id && onViewUserProfile?.(post.user_id)}
                    style={{ width: 42, height: 42, cursor: post.user_id ? "pointer" : "default" }}>
                    {post.avatar && String(post.avatar).startsWith("http") ? (
                      <img src={post.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      post.avatar || initials(post.user)
                    )}
                  </div>
                  <div onClick={() => post.user_id && onViewUserProfile?.(post.user_id)} style={{ cursor: post.user_id ? "pointer" : "default" }}>
                    <div style={{ fontWeight: 600, color: "var(--brown4)", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      {post.user}
                      {post.type === "recruiter" && <span className="tag" style={{ background: "var(--brown4)", color: "#fff", fontSize: 9 }}>RECRUITER</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>@{post.handle} · {post.time}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {post.user_id === user.id && (
                    <button 
                      type="button" 
                      onClick={() => deleteMyPost(post.id)} 
                      className="btn-ghost" 
                      style={{ padding: "4px 8px", fontSize: 11, borderRadius: 8, color: "#8A2E25", border: "1px solid #8A2E25", cursor: "pointer" }}
                    >
                      🗑 Delete
                    </button>
                  )}
                  <span className="tag" style={{ background: post.tagBg, color: post.tagColor }}>{post.tag}</span>
                </div>
              </div>

              <p style={{ marginTop: 14, color: "var(--text)", lineHeight: 1.6, fontSize: 14.5 }}>{post.text}</p>
              
              {post.jobPostingId && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "var(--cream2)", border: "1px solid var(--border)", fontSize: 13, color: "var(--brown3)" }}>
                  🔗 Linked recruiter opening — apply with your SCHLR CV below.
                </div>
              )}
              {post.imageUrl && (
                <img src={post.imageUrl} alt="" style={{ marginTop: 12, width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }} />
              )}

              {user.userType === "student" && post.jobPostingId && (
                <div className="glass-panel" style={{ marginTop: 14, padding: 14, background: "rgba(255,255,255,0.2)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brown4)", marginBottom: 10 }}>Apply to this opening with your CV</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <button type="button" disabled={applyBusy === post.jobPostingId} className="btn-primary" style={{ padding: "9px 18px" }}
                      onClick={() => applyWithSavedCv(post.jobPostingId)}>
                      {applyBusy === post.jobPostingId ? "Submitting…" : "Submit CV (saved profile)"}
                    </button>
                    <button type="button" className="btn-ghost" disabled={applyBusy === post.jobPostingId} onClick={() => applyCvToLinkedJob(post.jobPostingId)}>
                      Upload different PDF & apply
                    </button>
                  </div>
                  {applyMsg[post.jobPostingId] && (
                    <div style={{ marginTop: 10, fontSize: 13, color: applyMsg[post.jobPostingId].includes("Error") ? "#8A2E25" : "#1A7A4A" }}>
                      {applyMsg[post.jobPostingId]}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                <button type="button" onClick={() => likePost(post.id)} className="btn-ghost" style={{ padding: "8px 14px", color: post.liked ? "var(--brown3)" : "var(--muted)" }}>
                  <span>{post.liked ? "♥" : "♡"}</span> {post.likes}
                </button>
                <button type="button" onClick={() => setOpenComments(openComments === post.id ? null : post.id)} className="btn-ghost" style={{ padding: "8px 14px" }}>
                  <span>💬</span> {post.commentList?.length || 0}
                </button>
                <button type="button" onClick={() => savePost(post.id)} className="btn-ghost" style={{ padding: "8px 14px", color: post.saved ? "var(--brown3)" : "var(--muted)", marginLeft: "auto" }}>
                  <span>{post.saved ? "🔖" : "🏷"}</span> {post.saved ? "Saved" : "Save"}
                </button>
              </div>

              {openComments === post.id && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  {(post.commentList || []).map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                      <div className="avatar" onClick={() => c.userId && onViewUserProfile?.(c.userId)}
                        style={{ width: 30, height: 30, fontSize: 11, cursor: c.userId ? "pointer" : "default" }}>
                        {initials(c.u)}
                      </div>
                      <div className="glass-panel" style={{ padding: "9px 14px", flex: 1, borderRadius: 12 }}>
                        <div onClick={() => c.userId && onViewUserProfile?.(c.userId)}
                          style={{ fontSize: 12, fontWeight: 600, color: "var(--brown4)", marginBottom: 3, cursor: c.userId ? "pointer" : "default" }}>
                          {c.u}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>{c.t}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <input value={commentInput} onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addComment(post.id)}
                      placeholder="Write a comment…" className="glass-input" />
                    <button type="button" onClick={() => addComment(post.id)} className="btn-primary" style={{ padding: "9px 18px" }}>
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ==========================================
// 6. STUDENT JOBS SECTION
// ==========================================

export function StudentJobsSection({ user, token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState({});
  const [results, setResults] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [savedMap, setSavedMap] = useState({});

  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  const loadSaved = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/applications/me?status_filter=saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      const m = {};
      if (Array.isArray(d.items)) {
        d.items.forEach(app => {
          m[app.item_id] = app._id;
        });
      }
      setSavedMap(m);
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const toggleSave = async (itemId, itemType) => {
    const appId = savedMap[itemId];
    try {
      if (appId) {
        await fetch(`${API_BASE}/applications/${appId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        setSavedMap(prev => {
          const copy = { ...prev };
          delete copy[itemId];
          return copy;
        });
      } else {
        const r = await fetch(`${API_BASE}/applications`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: itemId, item_type: itemType, status: "saved" })
        });
        const d = await r.json();
        if (r.ok && d.id) {
          setSavedMap(prev => ({ ...prev, [itemId]: d.id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/jobs/public?limit=40`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Could not load jobs.");
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setError(e.message || "Failed to load.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadCvAndApply = async (jobId) => {
    setBusyId(jobId);
    setMsg((m) => ({ ...m, [jobId]: "" }));
    setResults((r) => ({ ...r, [jobId]: null }));
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp";
      const picked = await new Promise((resolve) => {
        input.onchange = () => resolve(input.files?.[0] || null);
        input.click();
      });
      if (!picked) throw new Error("Pick a CV file to apply with.");

      const fd = new FormData();
      fd.append("file", picked);
      fd.append("notes", "Applied via SCHLR");

      const r = await fetch(`${API_BASE}/jobs/${jobId}/apply-with-cv`, {
        method: "POST",
        headers: { ...auth, Accept: "application/json" },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Application failed.");
      setResults((r) => ({ ...r, [jobId]: data.cv_analysis || null }));
      setMsg((m) => ({ ...m, [jobId]: "Application submitted." }));
    } catch (e) {
      setMsg((m) => ({ ...m, [jobId]: e.message || "Error" }));
    } finally {
      setBusyId(null);
    }
  };

  const applyWithSavedCv = async (jobId) => {
    const cvUrl = (user.cvUrl || "").trim();
    if (!cvUrl) {
      await uploadCvAndApply(jobId);
      return;
    }
    setBusyId(jobId);
    setMsg((m) => ({ ...m, [jobId]: "" }));
    try {
      const r = await fetch(`${API_BASE}/applications`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: jobId,
          item_type: "job_posting",
          status: "applied",
          cv_url: cvUrl,
          notes: "Applied via SCHLR",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Application failed.");
      setMsg((m) => ({ ...m, [jobId]: "Application submitted." }));
    } catch (e) {
      setMsg((m) => ({ ...m, [jobId]: e.message }));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <GooeyLoader size="medium" text="Loading opportunities..." />;
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <h2>Jobs & internships from recruiters</h2>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Apply with your CV (PDF). You can store a default résumé on your profile, or upload a new file when you apply.
      </p>
      {error && <div style={{ padding: 14, borderRadius: 10, background: "var(--cream3)", color: "var(--brown4)", marginBottom: 16 }}>{error}</div>}
      
      {items.length === 0 ? (
        <div className="glass-panel" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          No active postings yet. Check back soon.
        </div>
      ) : (
        items.map((j) => (
          <div key={j._id} className="glass-panel" style={{ padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "var(--brown3)", textTransform: "uppercase" }}>
              {j.employment_type || "Role"} · {j.location_type || "On-site"} {j.location ? ` · ${j.location}` : ""}
            </div>
            <h3 style={{ fontSize: 22, color: "var(--brown4)", marginTop: 10, marginBottom: 4 }}>{j.title}</h3>
            <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>{j.company_name || "Company"}</div>
            <p style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{j.description}</p>
            
            {(j.skills_keywords || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {j.skills_keywords.map((s) => (<span key={s} className="tag">{s}</span>))}
              </div>
            )}
            
            <div style={{ fontSize: 13, marginTop: 16, color: "var(--brown3)" }}>
              <strong>How to apply (direct):</strong> <span style={{ wordBreak: "break-all" }}>{j.apply_how}</span>
            </div>
            
            <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button type="button" disabled={busyId === j._id} className="btn-primary" onClick={() => applyWithSavedCv(j._id)}>
                {busyId === j._id ? "Submitting…" : "Submit application (CV)"}
              </button>
              <button type="button" className="btn-ghost" disabled={busyId === j._id} onClick={() => uploadCvAndApply(j._id)}>
                Upload different CV & apply
              </button>
              <button 
                type="button" 
                onClick={() => toggleSave(j._id, "job_posting")} 
                className="btn-ghost" 
                style={{ padding: "8px 16px", color: savedMap[j._id] ? "var(--brown3)" : "var(--muted)", marginLeft: "auto", borderRadius: 8 }}
              >
                {savedMap[j._id] ? "Saved" : "Save"}
              </button>
            </div>

            {msg[j._id] && (
              <div style={{ marginTop: 12, fontSize: 13, color: msg[j._id].includes("submitted") ? "#1A7A4A" : "#8A2E25" }}>
                {msg[j._id]}
              </div>
            )}

            {results[j._id] && (
              <div className="glass-panel" style={{ marginTop: 12, padding: 14, background: "rgba(255,255,255,0.15)" }}>
                <div style={{ fontWeight: 600, color: "var(--brown4)", marginBottom: 8 }}>CV match preview</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <small style={{ color: "var(--muted)" }}>Score: {results[j._id].score}</small>
                  <small style={{ color: "var(--muted)" }}>Status: {results[j._id].status}</small>
                </div>
                {results[j._id].matched_required_keywords?.length > 0 && (
                  <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Matched required:</strong> {results[j._id].matched_required_keywords.join(", ")}</div>
                )}
                {results[j._id].missing_required_keywords?.length > 0 && (
                  <div style={{ fontSize: 12, color: "#8A2E25" }}><strong>Missing required:</strong> {results[j._id].missing_required_keywords.join(", ")}</div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ==========================================
// 7. MATCHES SECTION
// ==========================================

export function MultiSelectDropdown({ label, options, selected, onChange, placeholder = "Select options" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(x => x !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const displayText = selected.length === 0 
    ? placeholder 
    : selected.length <= 2 
      ? selected.join(", ") 
      : `${selected.length} selected`;

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={dropdownRef} style={{ position: "relative", flex: 1, minWidth: 200 }}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="glass-select-button"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          padding: "10px 16px",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          background: "rgba(255, 255, 255, 0.08)",
          color: "var(--text)",
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          fontWeight: "550",
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transition: "all 0.25s ease"
        }}
      >
        <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", marginRight: 8, color: selected.length ? "var(--brown3)" : "var(--text)" }}>
          {label}: {displayText}
        </span>
        <span style={{ 
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", 
          transition: "transform 0.25s ease",
          fontSize: 10,
          color: "var(--brown3)"
        }}>▼</span>
      </button>

      <div className="multi-select-dropdown-panel"
        style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          right: 0,
          zIndex: 9999,
          maxHeight: 250,
          overflowY: "auto",
          padding: "8px 0",
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateY(0)" : "translateY(-10px)",
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          backgroundColor: "var(--white-solid)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "var(--shadow-lg)",
          backdropFilter: "none",
          WebkitBackdropFilter: "none"
        }}
      >
        {options.length > 5 && (
          <div style={{ padding: "6px 12px 10px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
            <input 
              type="text" 
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--cream)",
                color: "var(--text-h)",
                fontSize: "13px",
                outline: "none",
                transition: "all 0.2s ease"
              }}
            />
          </div>
        )}
        {filteredOptions.length === 0 ? (
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            No options found
          </div>
        ) : (
          filteredOptions.map((opt) => {
            const isChecked = selected.includes(opt);
            return (
              <label 
                key={opt}
                className="multi-select-option"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: "13.5px",
                  userSelect: "none"
                }}
              >
                <input 
                  type="checkbox" 
                  checked={isChecked}
                  onChange={() => toggleOption(opt)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    accentColor: "var(--brown3)",
                    width: 14,
                    height: 14,
                    cursor: "pointer"
                  }}
                />
                <span className="option-text" style={{
                  color: isChecked ? "var(--brown3)" : "var(--text)",
                  fontWeight: isChecked ? "600" : "500",
                  transition: "transform 0.2s ease, color 0.2s ease"
                }}>{opt}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export function MatchesSection({ token, user }) {
  const getInitialDegree = () => {
    const pd = user?.profile?.degree || "";
    const pdl = pd.toLowerCase();
    if (pdl.includes("bachelor") || pdl.includes("bs") || pdl.includes("bsc") || pdl.includes("undergraduate")) return "Bachelors";
    if (pdl.includes("master") || pdl.includes("ms") || pdl.includes("msc") || pdl.includes("m.phil")) return "Masters / MPhil";
    if (pdl.includes("phd") || pdl.includes("doctor") || pdl.includes("ph.d")) return "PhD / Doctoral";
    if (pdl.includes("postdoc")) return "Postdoctoral";
    return "";
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedMap, setSavedMap] = useState({});

  const initialCountry = user?.profile?.target_country;
  const initialDegree = getInitialDegree();

  const [selectedCountries, setSelectedCountries] = useState(initialCountry ? [initialCountry] : []);
  const [selectedDegrees, setSelectedDegrees] = useState(initialDegree ? [initialDegree] : []);

  const loadSaved = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/applications/me?status_filter=saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      const m = {};
      if (Array.isArray(d.items)) {
        d.items.forEach(app => {
          m[app.item_id] = app._id;
        });
      }
      setSavedMap(m);
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const toggleSave = async (itemId, itemType) => {
    const appId = savedMap[itemId];
    try {
      if (appId) {
        await fetch(`${API_BASE}/applications/${appId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        setSavedMap(prev => {
          const copy = { ...prev };
          delete copy[itemId];
          return copy;
        });
      } else {
        const r = await fetch(`${API_BASE}/applications`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: itemId, item_type: itemType, status: "saved" })
        });
        const d = await r.json();
        if (r.ok && d.id) {
          setSavedMap(prev => ({ ...prev, [itemId]: d.id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`${API_BASE}/recommendations/matches?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.detail || "Unable to load matches.");
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const filteredScholarships = useMemo(() => {
    if (!data?.scholarships) return [];
    return data.scholarships.filter(s => {
      if (selectedCountries.length > 0) {
        const ctry = (s.country || "").toLowerCase();
        const matchesCountry = selectedCountries.some(c => ctry.includes(c.toLowerCase()));
        if (!matchesCountry) return false;
      }
      if (selectedDegrees.length > 0) {
        const docDegree = (s.degree_level || "").toLowerCase();
        const hay = ((s.title || "") + " " + (s.eligibility || "")).toLowerCase();
        const matchesDegree = selectedDegrees.some(d => {
          if (d === "Bachelors") {
            return docDegree.includes("bachelor") || docDegree.includes("undergraduate") || docDegree.includes("bs") || docDegree.includes("bsc") ||
                   hay.includes("bachelor") || hay.includes("undergraduate") || hay.includes("bs") || hay.includes("bsc");
          }
          if (d === "Masters / MPhil") {
            return docDegree.includes("master") || docDegree.includes("m.phil") || docDegree.includes("msc") || docDegree.includes("ms") ||
                   hay.includes("master") || hay.includes("m.phil") || hay.includes("msc") || hay.includes("ms");
          }
          if (d === "PhD / Doctoral") {
            return docDegree.includes("phd") || docDegree.includes("doctoral") || docDegree.includes("ph.d") ||
                   hay.includes("phd") || hay.includes("doctoral") || hay.includes("ph.d");
          }
          if (d === "Postdoctoral") {
            return docDegree.includes("postdoc") || docDegree.includes("postdoctoral") ||
                   hay.includes("postdoc") || hay.includes("postdoctoral");
          }
          return false;
        });
        if (!matchesDegree) return false;
      }
      return true;
    });
  }, [data?.scholarships, selectedCountries, selectedDegrees]);

  const filteredInternships = useMemo(() => {
    if (!data?.internships) return [];
    return data.internships.filter(i => {
      if (selectedCountries.length > 0) {
        const loc = (i.location || "").toLowerCase();
        const matchesCountry = selectedCountries.some(c => {
          if (c.toLowerCase() === "remote") return loc.includes("remote");
          return loc.includes(c.toLowerCase()) || loc.includes("remote");
        });
        if (!matchesCountry) return false;
      }
      if (selectedDegrees.length > 0) {
        const hay = ((i.title || "") + " " + (i.field || "") + " " + (i.description_excerpt || "")).toLowerCase();
        const matchesDegree = selectedDegrees.some(d => {
          if (d === "Bachelors") {
            if ((hay.includes("master") || hay.includes("phd") || hay.includes("ph.d")) && 
                (!hay.includes("bachelor") && !hay.includes("undergraduate") && !hay.includes("bs") && !hay.includes("bsc"))) {
              return false;
            }
            return true;
          }
          if (d === "Masters / MPhil") {
            if (hay.includes("master") || hay.includes("postgraduate") || hay.includes("ms") || hay.includes("msc") || hay.includes("m.phil")) {
              return true;
            }
            return !hay.includes("bachelor") && !hay.includes("phd") && !hay.includes("ph.d");
          }
          if (d === "PhD / Doctoral") {
            if (hay.includes("phd") || hay.includes("doctoral") || hay.includes("ph.d") || hay.includes("doctor")) {
              return true;
            }
            return !hay.includes("bachelor") && !hay.includes("master") && !hay.includes("bs");
          }
          if (d === "Postdoctoral") {
            return hay.includes("postdoc") || hay.includes("postdoctoral");
          }
          return true;
        });
        if (!matchesDegree) return false;
      }
      return true;
    });
  }, [data?.internships, selectedCountries, selectedDegrees]);

  const cardSch = (s) => (
    <div key={s._id} className="glass-panel" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--brown3)", textTransform: "uppercase" }}>
        Scholarship · {(s.type || "").toUpperCase()}
      </div>
      <h3 style={{ fontSize: 18, color: "var(--brown4)", marginTop: 8, marginBottom: 4 }}>{s.title}</h3>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{s.country}{s.university ? ` · ${s.university}` : ""}</div>
      <p style={{ fontSize: 14, lineHeight: 1.55 }}>{s.eligibility}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        {s.apply_url && (
          <a href={s.apply_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: "6px 14px", fontSize: 12, textDecoration: "none", borderRadius: 8 }}>
            Apply / details →
          </a>
        )}
        <button 
          type="button" 
          onClick={() => toggleSave(s._id, "scholarship")} 
          className="btn-ghost" 
          style={{ padding: "6px 12px", fontSize: 12, color: savedMap[s._id] ? "var(--brown3)" : "var(--muted)", borderRadius: 8 }}
        >
          {savedMap[s._id] ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );

  const cardInt = (i) => (
    <div key={i._id} className="glass-panel" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--brown3)", textTransform: "uppercase" }}>Internship</div>
      <h3 style={{ fontSize: 18, color: "var(--brown4)", marginTop: 8, marginBottom: 4 }}>{i.title}</h3>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{i.company} · {i.location} {i.field ? `· ${i.field}` : ""}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        {i.apply_url && (
          <a href={i.apply_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: "6px 14px", fontSize: 12, textDecoration: "none", borderRadius: 8 }}>
            Apply →
          </a>
        )}
        <button 
          type="button" 
          onClick={() => toggleSave(i._id, "internship")} 
          className="btn-ghost" 
          style={{ padding: "6px 12px", fontSize: 12, color: savedMap[i._id] ? "var(--brown3)" : "var(--muted)", borderRadius: 8 }}
        >
          {savedMap[i._id] ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <h2>Personalized Picks</h2>
      <p style={{ color: "var(--muted)", marginBottom: 24, maxWidth: 640 }}>
        Scholarships and internships ranked by overlap with your major, destinations, and interests. Refine these from your Profile to improve matches.
      </p>

      {error && <div style={{ padding: 14, borderRadius: 10, background: "var(--cream3)", color: "var(--brown4)", fontSize: 14, marginBottom: 20 }}>{error}</div>}

      {/* Profile summary status panel */}
      {data?.profile_summary && (
        <div className="glass-panel" style={{ padding: "12px 18px", marginBottom: 20, fontSize: 14 }}>
          Matching on profile:{" "}
          <strong style={{ color: "var(--brown4)" }}>
            {[data.profile_summary.degree, data.profile_summary.major, data.profile_summary.target_country]
              .filter(Boolean)
              .join(" · ") || "Incomplete — edit Profile"}
          </strong>
        </div>
      )}

      {/* Animated Dropdown Filter Bar */}
      <div className="glass-panel animate-fade-in" style={{ padding: "16px 20px", marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--brown4)" }}>
          🔍 Quick Filter Matches:
        </div>
        <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 280 }}>
          <MultiSelectDropdown 
            label="Country" 
            options={COUNTRIES} 
            selected={selectedCountries} 
            onChange={setSelectedCountries} 
            placeholder="All Countries 🌐" 
          />
          <MultiSelectDropdown 
            label="Degree" 
            options={["Bachelors", "Masters / MPhil", "PhD / Doctoral", "Postdoctoral"]} 
            selected={selectedDegrees} 
            onChange={setSelectedDegrees} 
            placeholder="All Degrees 🎓" 
          />
        </div>
      </div>

      {loading && <GooeyLoader size="medium" text="Loading personalized picks..." />}

      {data && !loading && (
        <div key={`${selectedCountries.join("-")}-${selectedDegrees.join("-")}`} className="animate-fade-in-up" style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <h3 style={{ fontSize: 20, color: "var(--brown4)", marginBottom: 12 }}>Scholarships</h3>
            {filteredScholarships.length === 0 ? (
              <div style={{ color: "var(--muted)" }}>None in database matching filters.</div>
            ) : (
              filteredScholarships.slice(0, 12).map(cardSch)
            )}
          </div>
          <div>
            <h3 style={{ fontSize: 20, color: "var(--brown4)", marginBottom: 12 }}>Internships</h3>
            {filteredInternships.length === 0 ? (
              <div style={{ color: "var(--muted)" }}>No internships matching filters.</div>
            ) : (
              filteredInternships.slice(0, 12).map(cardInt)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 8. DRIBBBLE STYLE CHAT SECTION
// ==========================================

export function ChatSection({ user, token }) {
  const [activeBot, setActiveBot] = useState(SPECIALIZED_BOTS[0]);
  const [chats, setChats] = useState({
    general: [
      {
        role: "assistant",
        text: `Hello ${user.name?.split(" ")[0] || "there"}! I'm your SCHLR AI advisor. What would you like to escape to today in your academic journey? Choose a quick suggestion or type below.`
      }
    ]
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const msgs = chats[activeBot.id] || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (explicitMsg) => {
    const textToSend = (explicitMsg || input).trim();
    if (!textToSend || loading) return;
    
    setInput("");
    const updated = [...msgs, { role: "user", text: textToSend }];
    setChats((c) => ({ ...c, [activeBot.id]: updated }));
    setLoading(true);
    
    try {
      const resp = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question: textToSend,
          conversation_history: updated.map(m => ({ role: m.role, content: m.text })),
          bot_type: activeBot.id
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || "Request failed");
      
      let reply = data.answer || "No response received.";
      if (data.warning === "ai_upstream") {
        reply += "\n\n— Note: language model unreachable. Verify ANTHROPIC_API_KEY in backend/.env.";
      }
      if (Array.isArray(data.sources) && data.sources.length > 0) {
        reply += "\n\nSources:\n" + data.sources.slice(0, 3).map((u) => "• " + u).join("\n");
      }
      
      setChats((c) => ({
        ...c,
        [activeBot.id]: [...updated, { role: "assistant", text: reply }]
      }));
    } catch (err) {
      setChats((c) => ({
        ...c,
        [activeBot.id]: [...updated, { role: "assistant", text: err.message || "Network error." }]
      }));
    } finally {
      setLoading(false);
    }
  };

  // Suggestion card prompts mapped to their display titles
  const suggestions = [
    { title: "Find Scholarships 🎓", subtitle: "List top fully-funded STEM opportunities", prompt: "List the top 5 fully-funded STEM scholarships currently active." },
    { title: "Review CV / Resume 📄", subtitle: "Analyze my CV alignment for software roles", prompt: "How can I optimize my CV layout for software engineering internships?" },
    { title: "Essay Coach ✍️", subtitle: "Tips for drafting statement of purpose", prompt: "Give me outline recommendations for writing a strong statement of purpose essay." },
    { title: "Study Abroad Guide ✈️", subtitle: "Visa & fee guidelines for Europe", prompt: "What are the typical study visa requirements for Germany and Germany's blocked account details?" }
  ];

  return (
    <div style={{ height: "calc(100vh - 62px - 84px)", display: "flex", gap: 20 }}>
      {/* Bot Selector Panel */}
      <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ fontSize: 18, color: "var(--brown4)", paddingLeft: 4, margin: "0 0 4px" }}>AI Advisors</h3>
        {SPECIALIZED_BOTS.map((bot) => (
          <div key={bot.id} onClick={() => setActiveBot(bot)}
            className={`bot-select-card ${activeBot.id === bot.id ? "active" : ""}`}>
            <span style={{ fontSize: 24 }}>{bot.icon}</span>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brown4)" }}>{bot.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bot.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Chat Window */}
      <div className="chat-message-pane" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyJoin: "space-between", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>{activeBot.icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: "var(--brown4)" }}>{activeBot.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{activeBot.desc}</div>
            </div>
          </div>
          <div style={{ padding: "4px 12px", borderRadius: 99, background: "rgba(26, 122, 74, 0.1)", color: "#1A7A4A", fontSize: 11, fontWeight: 700 }}>● Online</div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}>
              {m.role === "assistant" && (
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 14, flexShrink: 0, background: "var(--cream3)" }}>
                  {activeBot.icon}
                </div>
              )}
              <div className={`chat-bubble ${m.role}`}>{m.text}</div>
              {m.role === "user" && (
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, background: "var(--brown2)" }}>
                  {initials(user.name || "U")}
                </div>
              )}
            </div>
          ))}
          
          {/* Suggestions card grid - shown when only welcome message is present */}
          {msgs.length === 1 && (
            <div className="chat-suggestions-grid">
              {suggestions.map((s, idx) => (
                <div key={idx} className="chat-suggestion-card" onClick={() => send(s.prompt)}>
                  <div>{s.title}</div>
                  <span>{s.subtitle}</span>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 14, background: "var(--cream3)" }}>{activeBot.icon}</div>
              <div className="chat-bubble assistant" style={{ display: "flex", gap: 5, padding: "12px 16px" }}>
                {[0, 1, 2].map((x) => (
                  <div key={x} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brown2)", animation: `bounce-dots 1.2s ${x * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input Bar */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
          <div className="chat-input-pill-wrapper">
            <span style={{ fontSize: 18, marginLeft: 10, cursor: "pointer", color: "var(--muted)" }}>📎</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`Message ${activeBot.name}…`}
            />
            <button className="btn-primary" onClick={() => send()} style={{ padding: "8px 16px", borderRadius: 99 }} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-dots { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}

// ==========================================
// 9. GUIDES SECTION
// ==========================================

export function GuidesSection() {
  const [guide, setGuide] = useState(null);
  const [open, setOpen] = useState({});
  
  useEffect(() => {
    fetch(`${API_BASE}/guides/degree-attestation`)
      .then((r) => r.json())
      .then(setGuide)
      .catch(() => setGuide(null));
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2>{guide?.title || "Documentation guide"}</h2>
      {guide?.disclaimer && (
        <div className="glass-panel" style={{ padding: "16px 18px", marginBottom: 24, fontSize: 14, background: "var(--cream2)", borderLeft: "4px solid var(--brown2)" }}>
          {guide.disclaimer}
        </div>
      )}
      {(guide?.sections || []).map((sec) => (
        <div key={sec.id} className="glass-panel" style={{ marginBottom: 16, overflow: "hidden" }}>
          <button type="button" onClick={() => setOpen((o) => ({ ...o, [sec.id]: !o[sec.id] }))}
            style={{
              width: "100%", textAlign: "left", padding: "18px 20px", border: "none", background: "transparent",
              fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600, color: "var(--brown4)", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
            <span>{sec.authority}</span>
            <span style={{
              transform: open[sec.id] ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "inline-block",
              fontSize: 12,
              color: "var(--brown3)"
            }}>▼</span>
          </button>
          <div style={{
            display: "grid",
            gridTemplateRows: open[sec.id] ? "1fr" : "0fr",
            transition: "grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 14 }}>{sec.summary}</p>
                <ol style={{ marginLeft: 18, marginBottom: 12, fontSize: 14, lineHeight: 1.8, color: "var(--text)" }}>
                  {(sec.steps || []).map((st, idx) => (
                    <li key={idx}>{(typeof st === "string" ? st : st.detail) || ""}</li>
                  ))}
                </ol>
                {(sec.references || []).map((rf, idx) => (
                  <div key={idx} style={{ fontSize: 14, marginBottom: 6 }}>
                    <a href={rf.url} target="_blank" rel="noreferrer" style={{ color: "var(--brown3)", fontWeight: 600 }}>
                      {rf.label} →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// 10. MESSAGING SECTION
// ==========================================
export function MessagingSection({ user, token, activeRecipientId, onViewUserProfile }) {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const endRef = useRef(null);
  const handleWebSocketMessageRef = useRef(null);

  const authH = { Authorization: `Bearer ${token}` };

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    const wsUrl = `${API_BASE.replace('http', 'ws')}/ws/${user.id}?token=${token}`;
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      setIsConnected(true);
      setErr("");
    };

    newWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessageRef.current?.(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    newWs.onclose = () => {
      setIsConnected(false);
      if (wsRef.current === newWs && user && token) {
        setTimeout(() => {
          if (wsRef.current === newWs && user && token) {
            connectWebSocket();
          }
        }, 3000);
      }
    };

    newWs.onerror = () => {
      setErr("Connection lost. Reconnecting...");
    };

    wsRef.current = newWs;
  }, [user.id, token]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      socket.close();
      setIsConnected(false);
    }
  }, []);

  const handleWebSocketMessage = (data) => {
    const { type } = data;
    if (type === 'message' || type === 'message_sent') {
      if (data.thread_id === activeThread?.thread_id) {
        setMessages(prev => [...prev, data]);
        if (type === 'message' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'read', thread_id: data.thread_id }));
        }
      }
      loadThreads();
    } else if (type === 'typing') {
      if (data.thread_id === activeThread?.thread_id && data.sender_id !== user.id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    } else if (type === 'read') {
      if (data.thread_id === activeThread?.thread_id) {
        setMessages(prev => prev.map(msg =>
          msg.sender_id === user.id ? { ...msg, read: true } : msg
        ));
      }
    } else if (type === 'message_deleted') {
      if (data.thread_id === activeThread?.thread_id) {
        setMessages(prev => prev.filter(msg => msg._id !== data.message_id && msg.id !== data.message_id));
      }
      loadThreads();
    } else if (type === 'user_status') {
      setOnlineUsers(prev => ({
        ...prev,
        [data.user_id]: data.status === 'online'
      }));
    }
  };

  handleWebSocketMessageRef.current = handleWebSocketMessage;

  const sendWebSocketMessage = (messageData) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(messageData));
    }
  };

  const loadThreads = async () => {
    try {
      const r = await fetch(`${API_BASE}/dm/threads`, { headers: authH });
      const data = await r.json().catch(() => []);
      const initialOnline = {};
      if (Array.isArray(data)) {
        data.forEach(th => {
          if (th.other_users) {
            th.other_users.forEach(u => {
              initialOnline[u.id] = u.is_online;
            });
          } else if (th.other_user) {
            initialOnline[th.other_user.id] = th.other_user.is_online;
          }
        });
      }
      setOnlineUsers(prev => ({ ...prev, ...initialOnline }));
      setThreads(Array.isArray(data) ? data : []);
    } catch {
      setThreads([]);
    }
  };

  useEffect(() => { loadThreads(); }, [token]);

  useEffect(() => {
    if (activeRecipientId && token) {
      const initThread = async () => {
        setBusy(true);
        setErr("");
        try {
          const r = await fetch(`${API_BASE}/dm/threads`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: activeRecipientId }),
          });
          const thread = await r.json();
          if (!r.ok) throw new Error(thread.detail || "Could not open conversation.");
          await loadThreads();
          await openThread(thread);
        } catch (e) {
          setErr(e.message || "Could not start chat.");
        } finally {
          setBusy(false);
        }
      };
      initThread();
    }
  }, [activeRecipientId, token]);

  const openThread = async (th) => {
    setActiveThread(th);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/dm/threads/${th.thread_id}/messages`, { headers: authH });
      const data = await r.json().catch(() => []);
      setMessages(Array.isArray(data) ? data : []);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'read', thread_id: th.thread_id }));
      }
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    if (activeThread && isConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'read', thread_id: activeThread.thread_id }));
    }
  }, [activeThread, isConnected]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = searchQ.trim();
      if (q.length < 2) {
        setSearchHits([]);
        return;
      }
      try {
        const r = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(q)}`, { headers: authH });
        const d = await r.json();
        setSearchHits(d.users || []);
      } catch {
        setSearchHits([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeThread]);

  useEffect(() => {
    if (user && token) {
      connectWebSocket();
    }
    return () => {
      disconnectWebSocket();
    };
  }, [user, token, connectWebSocket, disconnectWebSocket]);

  const handleSelectUser = (u) => {
    if (selectedRecipients.some(x => x.id === u.id)) return;
    setSelectedRecipients(prev => [...prev, u]);
    setSearchQ("");
    setSearchHits([]);
  };

  const startSelfDm = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/dm/threads`, {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_ids: [user.id] }),
      });
      const thread = await r.json();
      if (!r.ok) throw new Error(thread.detail || "Could not start self chat.");
      await loadThreads();
      await openThread(thread);
    } catch (e) {
      setErr(e.message || "Could not start self chat.");
    } finally {
      setBusy(false);
    }
  };

  const startGroupDm = async () => {
    if (selectedRecipients.length === 0) return;
    setBusy(true);
    setErr("");
    try {
      const ids = selectedRecipients.map(r => r.id);
      const r = await fetch(`${API_BASE}/dm/threads`, {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_ids: ids }),
      });
      const thread = await r.json();
      if (!r.ok) throw new Error(thread.detail || "Could not start group chat.");
      await loadThreads();
      setSelectedRecipients([]);
      await openThread(thread);
    } catch (e) {
      setErr(e.message || "Could not start group chat.");
    } finally {
      setBusy(false);
    }
  };

  const startDm = async (hit) => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/dm/threads`, {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: hit.id }),
      });
      const thread = await r.json();
      if (!r.ok) throw new Error(thread.detail || "Could not open conversation.");
      await loadThreads();
      setSearchQ("");
      setSearchHits([]);
      await openThread(thread);
    } catch (e) {
      setErr(e.message || "Could not start chat.");
    } finally {
      setBusy(false);
    }
  };

  const deleteDM = async (messageId) => {
    if (!confirm("Delete this message? This will remove it for everyone in the conversation.")) return;
    try {
      const r = await fetch(`${API_BASE}/dm/messages/${messageId}`, {
        method: "DELETE",
        headers: authH
      });
      if (r.ok) {
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
      }
    } catch (e) {
      console.error("Failed to delete message", e);
    }
  };

  const send = async () => {
    if (!input.trim() || !activeThread) return;
    setBusy(true);
    setErr("");

    const messageText = input.trim();
    setInput("");

    try {
      if (isConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendWebSocketMessage({
          type: 'message',
          thread_id: activeThread.thread_id,
          text: messageText
        });
      } else {
        const r = await fetch(`${API_BASE}/dm/threads/${activeThread.thread_id}/messages`, {
          method: "POST",
          headers: { ...authH, "Content-Type": "application/json" },
          body: JSON.stringify({ text: messageText }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.detail || "Send failed");
        await openThread(activeThread);
      }
      await loadThreads();
    } catch (e) {
      setErr(e.message || "Send failed.");
      setInput(messageText);
    } finally {
      setBusy(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (activeThread && isConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: 'typing',
        thread_id: activeThread.thread_id,
        recipient_id: activeThread.other_user?.id || activeThread.other_user?._id,
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {}, 1000);
    }
  };

  const titleForThread = (th) => th?.other_user?.name || "Conversation";
  const subForThread = (th) => (th?.other_user?.handle ? "@" + th.other_user.handle : "");
  
  const renderMessagesList = () => {
    const rendered = [];
    let lastDateStr = null;

    messages.forEach((m, idx) => {
      // 1. Date Divider Logic
      const mDate = new Date(m.created_at);
      const dateStr = mDate.toDateString();

      if (dateStr !== lastDateStr) {
        let dateLabel = mDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if (dateStr === today.toDateString()) {
          dateLabel = "Today";
        } else if (dateStr === yesterday.toDateString()) {
          dateLabel = "Yesterday";
        }

        rendered.push(
          <div key={`date-${m._id || idx}`} className="chat-date-divider animate-fade-in">
            <span>{dateLabel}</span>
          </div>
        );
        lastDateStr = dateStr;
      }

      // 2. Message Grouping Logic (Instagram / WhatsApp Style)
      const mine = m.sender_id === user.id;
      
      const prevMsg = idx > 0 ? messages[idx - 1] : null;
      const prevMsgSameSender = prevMsg && prevMsg.sender_id === m.sender_id;
      const prevMsgCloseInTime = prevMsg && (new Date(m.created_at) - new Date(prevMsg.created_at)) < 2 * 60 * 1000;
      const prevMsgSameDay = prevMsg && new Date(prevMsg.created_at).toDateString() === dateStr;
      
      const isConsecutive = prevMsgSameSender && prevMsgCloseInTime && prevMsgSameDay;

      const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
      const nextMsgSameSender = nextMsg && nextMsg.sender_id === m.sender_id;
      const nextMsgCloseInTime = nextMsg && (new Date(nextMsg.created_at) - new Date(m.created_at)) < 2 * 60 * 1000;
      const nextMsgSameDay = nextMsg && new Date(nextMsg.created_at).toDateString() === dateStr;
      
      const hasNextConsecutive = nextMsgSameSender && nextMsgCloseInTime && nextMsgSameDay;

      let position = 'single';
      if (isConsecutive && hasNextConsecutive) {
        position = 'mid';
      } else if (isConsecutive && !hasNextConsecutive) {
        position = 'bot';
      } else if (!isConsecutive && hasNextConsecutive) {
        position = 'top';
      }

      // Show avatar only for peer messages, on the FIRST message of a group (position 'single' or 'top')
      const showAvatar = !mine && (position === 'top' || position === 'single');
      const needSpacer = !mine && !showAvatar;

      const when = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

      rendered.push(
        <div 
          key={m._id || idx} 
          className="chat-bubble-container" 
          style={{ 
            display: "flex", 
            justifyContent: mine ? "flex-end" : "flex-start", 
            gap: 8, 
            alignItems: "flex-end",
            marginTop: isConsecutive ? "2px" : "12px"
          }}
        >
          {showAvatar && (
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0, cursor: onViewUserProfile ? "pointer" : "default" }}
                 onClick={() => activePeer?.id && onViewUserProfile?.(activePeer.id)}
                 title={activePeer?.name}>
              {initials(activePeer?.name || "P")}
            </div>
          )}
          {needSpacer && <div style={{ width: 28, height: 28, flexShrink: 0 }} />}
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {mine && (
                <button 
                  type="button" 
                  onClick={() => deleteDM(m._id)} 
                  className="btn-ghost delete-msg-btn" 
                  style={{ padding: 4, minWidth: 20, minHeight: 20, fontSize: 10, cursor: "pointer", color: "var(--muted)", border: "none", background: "transparent" }}
                  title="Delete message"
                >
                  🗑
                </button>
              )}
              
              <div className={`chat-bubble ${mine ? 'user' : 'assistant'} bubble-${position}`}>
                {m.text}
              </div>
            </div>
            
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4, justifySelf: mine ? "flex-end" : "flex-start" }}>
              <span>{when}</span>
              {mine && (
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  {m.read ? (
                    <span title="Seen" style={{ color: "#3a86ff", display: "inline-flex", alignItems: "center", gap: 2, cursor: "default" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      <span style={{ fontSize: "9px", fontWeight: "600" }}>Seen</span>
                    </span>
                  ) : (
                    <span title="Sent" style={{ color: "var(--muted)", fontSize: "11px", fontWeight: "bold" }}>
                      ✓
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    });

    return rendered;
  };

  const activePeer = activeThread?.other_user;
  const label = activePeer ? `${activePeer.name} (${activePeer.handle ? "@" + activePeer.handle : ""})` : "Inbox";

  return (
    <div className={`messaging-section-root ${activeThread ? "chat-active" : ""}`} style={{ height: "calc(100vh - 62px - 84px)" }}>
      <div className="messaging-layout-container">
        <div className="contact-list-sidebar">
          <div style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 18, color: "var(--brown4)", margin: "0 0 10px" }}>Inbox</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Find people by name or @handle…"
                className="glass-input"
                style={{ fontSize: 13, padding: "8px 12px", flex: 1 }}
              />
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ padding: "8px 12px", fontSize: 11, whiteSpace: "nowrap", borderRadius: 8 }}
                onClick={startSelfDm}
                title="Message yourself"
              >
                📝 Note to self
              </button>
            </div>

            {selectedRecipients.length > 0 && (
              <div className="glass-panel" style={{ padding: 10, marginBottom: 8, background: "var(--cream2)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Selected recipients:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {selectedRecipients.map(r => (
                    <span key={r.id} className="tag animate-fade-in" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "var(--brown3)", color: "#fff" }}>
                      {r.name}
                      <button type="button" onClick={() => setSelectedRecipients(prev => prev.filter(x => x.id !== r.id))}
                        style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 11, padding: 0 }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn-primary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={startGroupDm}>
                    Start Chat ({selectedRecipients.length})
                  </button>
                  <button type="button" className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setSelectedRecipients([])}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {searchHits.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 160, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10, background: "var(--cream)" }}>
                {searchHits.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid var(--border)" }}>
                    <button type="button" disabled={busy} onClick={() => handleSelectUser(u)}
                      style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, padding: 0, color: "var(--text)" }}>
                      {u.name} <span style={{ color: "var(--muted)" }}>@{u.handle}</span>
                      {u.user_type === "recruiter" && <span className="tag" style={{ marginLeft: 6, fontSize: 8, padding: "2px 6px", background: "var(--brown4)", color: "#fff" }}>REC</span>}
                    </button>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" disabled={busy} onClick={() => startDm(u)} className="btn-primary" style={{ padding: "4px 8px", fontSize: 11, borderRadius: 8 }}>
                        Chat
                      </button>
                      {onViewUserProfile && (
                        <button type="button" onClick={() => onViewUserProfile(u.id)} className="btn-ghost" style={{ padding: "4px 8px", fontSize: 11, borderRadius: 8 }}>
                          Profile
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            {threads.map((th) => {
              const last = th.last_message;
              const isRecruiter = th.other_user?.user_type === "recruiter";
              const active = activeThread?.thread_id === th.thread_id;
              const isPeerOnline = th.other_user ? onlineUsers[th.other_user.id] : false;
              return (
                <div key={th.thread_id} onClick={() => openThread(th)}
                  className={`bot-select-card ${active ? "active" : ""}`} style={{ marginBottom: 4 }}>
                  <div className="avatar" onClick={(e) => { if (onViewUserProfile && th.other_user?.id) { e.stopPropagation(); onViewUserProfile(th.other_user.id); } }}
                    style={{ width: 40, height: 40, flexShrink: 0, cursor: onViewUserProfile ? "pointer" : "default" }}>
                    {initials(titleForThread(th))}
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brown4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
                      {titleForThread(th)}
                      {isPeerOnline && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1A7A4A", display: "inline-block" }} title="Online" />}
                      {isRecruiter && <span className="tag" style={{ marginLeft: 6, fontSize: 8, background: "var(--brown4)", color: "#fff" }}>REC</span>}
                    </div>
                    {last?.text && (
                      <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {last.sender_id === user.id ? "You: " : ""}{last.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {threads.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                No chats yet. Search above to message someone.
              </div>
            )}
          </div>
        </div>

        <div className="chat-message-pane" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="btn-ghost mobile-back-btn" onClick={() => setActiveThread(null)} style={{ display: "none", padding: "6px 12px", fontSize: 12, borderRadius: 10, marginRight: 8 }}>
              ← Back
            </button>
            <div className="avatar" onClick={() => activePeer?.id && onViewUserProfile?.(activePeer.id)}
              style={{ width: 38, height: 38, fontSize: 13, cursor: onViewUserProfile ? "pointer" : "default" }}>
              {activePeer?.name ? initials(activePeer.name) : "⋯"}
            </div>
            <div onClick={() => activePeer?.id && onViewUserProfile?.(activePeer.id)} style={{ cursor: onViewUserProfile ? "pointer" : "default", display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 600, color: "var(--brown4)" }}>{label}</div>
              {activePeer && activePeer.user_type !== "group" && (
                <div style={{ fontSize: 11, color: onlineUsers[activePeer.id] ? "#1A7A4A" : "var(--muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: onlineUsers[activePeer.id] ? "#1A7A4A" : "#8c7765", display: "inline-block" }} />
                  {onlineUsers[activePeer.id] ? "Online" : "Offline"}
                </div>
              )}
            </div>
          </div>

          {!!err && <div style={{ padding: "8px 16px", fontSize: 13, background: "var(--cream2)", color: "var(--brown4)", textAlign: "center" }}>{err}</div>}

          <div style={{ padding: "4px 16px", fontSize: 11, background: isConnected ? "rgba(26, 122, 74, 0.08)" : "rgba(66, 146, 198, 0.12)", color: isConnected ? "#1A7A4A" : "var(--brown3)", textAlign: "center" }}>
            {isConnected ? "🟢 Connected" : "🟡 Connecting..."}
          </div>

          <div className="chat-messages-container" style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {renderMessagesList()}
            {isTyping && activeThread && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 4 }} className="animate-fade-in">
                <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>
                  {initials(activePeer?.name || "P")}
                </div>
                <div className="typing-indicator-bubble">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
            <div className="chat-input-pill-wrapper">
              <input
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={!activeThread || busy}
                placeholder={activeThread ? "Write a secure message…" : "Select a conversation from the left"}
              />
              <button onClick={send} disabled={!activeThread || busy} className="btn-primary" style={{ padding: "8px 16px", borderRadius: 99 }}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 11. PROFILE SECTION
// ==========================================

export function ProfileSection({ user, allPosts, token, onUserRefresh, profileUserId, onStartDM, onBack, onLogout }) {
  const isOwnProfile = !profileUserId || profileUserId === user.id;

  const [targetUser, setTargetUser] = useState(null);
  const [loadingTarget, setLoadingTarget] = useState(false);

  const displayUser = targetUser || user;

  const isTargetRecruiter = displayUser.userType === "recruiter";
  const isTargetStudent = displayUser.userType === "student";
  const isTargetAdmin = displayUser.userType === "super_admin";

  const [tab, setTab] = useState("posts");
  const [editing, setEditing] = useState(false);
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0 });
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const [savedApps, setSavedApps] = useState([]);
  const [savedAppsLoading, setSavedAppsLoading] = useState(false);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);

  const loadSavedApps = async () => {
    if (!isOwnProfile || isTargetRecruiter || isTargetAdmin) return;
    setSavedAppsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/applications/me?status_filter=saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json().catch(() => ({}));
      setSavedApps(data.items || []);
    } catch (err) {
      console.error("Failed to load saved applications", err);
    } finally {
      setSavedAppsLoading(false);
    }
  };

  const loadSavedPosts = async () => {
    if (!isOwnProfile || isTargetRecruiter || isTargetAdmin) return;
    setSavedPostsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/users/${user.id}/saved-posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        const mapped = data.map(p => toFrontendPost(p, user.id));
        setSavedPosts(mapped);
      }
    } catch (err) {
      console.error("Failed to load saved posts", err);
    } finally {
      setSavedPostsLoading(false);
    }
  };
  
  const [profileData, setProfileData] = useState({
    bio: "", skills: "", linkedin: "", github: "", website: "",
    degree: "", countryResidence: "", recruiterTitle: "", industry: "",
    companySize: "", companyWebsite: "", linkedinCompanyUrl: "", university: "",
    workEmail: "", cvUploaded: false, openToInternship: false,
  });

  useEffect(() => {
    if (isTargetRecruiter) setTab("interests");
    else setTab("posts");
  }, [isTargetRecruiter, profileUserId]);

  useEffect(() => {
    const loadProfile = async () => {
      setLoadingTarget(true);
      if (isOwnProfile) {
        setTargetUser(null);
        try {
          const resp = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) return;
          const data = await resp.json();
          const p = data.profile || {};
          setFollowStats({
            followers: (data.followers || []).length,
            following: (data.following || []).length,
          });
          const cvU = (p.cv_url || "").trim();
          setProfileData({
            bio: data.bio ?? "",
            skills: p.skills ?? "",
            linkedin: p.linkedin_url ?? "",
            github: p.github_url ?? "",
            website: p.website_url ?? "",
            degree: p.degree ?? user.degree ?? "",
            countryResidence: p.country ?? user.countryResidence ?? "",
            recruiterTitle: p.recruiter_title ?? user.recruiterTitle ?? "",
            industry: p.industry ?? user.industry ?? "",
            companySize: p.company_size ?? user.companySize ?? "",
            companyWebsite: p.company_website ?? user.companyWebsite ?? "",
            linkedinCompanyUrl: p.linkedin_company_url ?? user.linkedinCompanyUrl ?? "",
            university: p.university ?? user.university ?? "",
            workEmail: (p.work_email || "").trim() || user.workEmail || user.email || "",
            cvUploaded: Boolean(cvU),
            openToInternship: p.open_to_internship ?? false,
          });
        } catch {
          // keep cached
        } finally {
          setLoadingTarget(false);
        }
      } else {
        try {
          const resp = await fetch(`${API_BASE}/users/${profileUserId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) return;
          const data = await resp.json();
          const mapped = mapMeToUser(data);
          setTargetUser(mapped);
          setFollowStats({
            followers: (mapped.followers || []).length,
            following: (mapped.following || []).length,
          });
          const p = data.profile || {};
          const cvU = (p.cv_url || "").trim();
          setProfileData({
            bio: data.bio ?? "",
            skills: p.skills ?? "",
            linkedin: p.linkedin_url ?? "",
            github: p.github_url ?? "",
            website: p.website_url ?? "",
            degree: p.degree ?? mapped.degree ?? "",
            countryResidence: p.country ?? mapped.countryResidence ?? "",
            recruiterTitle: p.recruiter_title ?? mapped.recruiterTitle ?? "",
            industry: p.industry ?? mapped.industry ?? "",
            companySize: p.company_size ?? mapped.companySize ?? "",
            companyWebsite: p.company_website ?? mapped.companyWebsite ?? "",
            linkedinCompanyUrl: p.linkedin_company_url ?? mapped.linkedinCompanyUrl ?? "",
            university: p.university ?? mapped.university ?? "",
            workEmail: (p.work_email || "").trim() || mapped.workEmail || mapped.email || "",
            cvUploaded: Boolean(cvU),
            openToInternship: p.open_to_internship ?? false,
          });
        } catch (err) {
          console.error("Error loading profile", err);
        } finally {
          setLoadingTarget(false);
        }
      }
    };
    loadProfile();
    loadSavedApps();
    loadSavedPosts();
  }, [profileUserId, token, user, isOwnProfile]);

  const handleFollowToggle = async () => {
    try {
      const resp = await fetch(`${API_BASE}/users/${profileUserId}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const resData = await resp.json();
      
      if (targetUser) {
        let newFollowers = [...(targetUser.followers || [])];
        if (resData.status === "followed") {
          newFollowers.push(user.id);
        } else {
          newFollowers = newFollowers.filter(id => id !== user.id);
        }
        setTargetUser(prev => prev ? ({ ...prev, followers: newFollowers }) : null);
        setFollowStats(prev => ({ ...prev, followers: newFollowers.length }));
      }
      onUserRefresh?.();
    } catch (e) {
      console.error(e);
    }
  };

  const uploadAvatarFile = async (file) => {
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API_BASE}/upload/image?folder=avatars`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Photo upload failed");
      const url = data.url;
      const pr = await fetch(`${API_BASE}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: url }),
      });
      if (!pr.ok) throw new Error("Could not save avatar");
      onUserRefresh?.();
    } catch (e) {
      alert(e.message || "Upload failed.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const uploadBannerFile = async (file) => {
    setBannerBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API_BASE}/upload/image?folder=avatars`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Cover upload failed");
      const url = data.url;
      const pr = await fetch(`${API_BASE}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ banner: url }),
      });
      if (!pr.ok) throw new Error("Could not save banner");
      onUserRefresh?.();
    } catch (e) {
      alert(e.message || "Banner upload failed.");
    } finally {
      setBannerBusy(false);
    }
  };

  const uploadCvFile = async (file) => {
    if (!file || !isTargetStudent) return;
    setCvBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API_BASE}/upload/document?folder=cvs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "CV upload failed.");
      const url = data.url;
      const pr = await fetch(`${API_BASE}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile: { cv_url: url } }),
      });
      if (!pr.ok) throw new Error("Could not save CV on profile.");
      setProfileData((p) => ({ ...p, cvUploaded: true }));
      onUserRefresh?.();
    } catch (e) {
      alert(e.message || "CV upload failed.");
    } finally {
      setCvBusy(false);
    }
  };

  const saveProfile = async () => {
    if (user.userType === "super_admin") {
      alert("Admin accounts do not support profile details edits.");
      return;
    }
    const recruiterFields =
      user.userType === "recruiter"
        ? {
            recruiter_title: profileData.recruiterTitle,
            industry: profileData.industry,
            company_size: profileData.companySize,
            company_website: profileData.companyWebsite,
            linkedin_company_url: profileData.linkedinCompanyUrl,
            work_email: profileData.workEmail?.trim() || undefined,
          }
        : {};
    await fetch(`${API_BASE}/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: user.name,
        bio: profileData.bio,
        profile: {
          major: user.major || "",
          university: profileData.university || user.university || "",
          target_country: user.targetCountry || "",
          interests: user.interests || [],
          skills: profileData.skills,
          linkedin_url: profileData.linkedin,
          github_url: profileData.github,
          website_url: profileData.website,
          degree: profileData.degree,
          country: profileData.countryResidence,
          ...recruiterFields,
        },
      }),
    });
    onUserRefresh?.();
  };

  const myPosts = allPosts.filter((p) => p.user_id === displayUser.id || p.handle === displayUser.handle);

  const handleUnsavePost = async (postId) => {
    if (!confirm("Are you sure you want to unsave this post?")) return;
    try {
      const resp = await fetch(`${API_BASE}/posts/${postId}/save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        loadSavedPosts();
      }
    } catch (err) {
      console.error("Failed to unsave post", err);
    }
  };

  const stats = [
    { label: "Posts", val: myPosts.length },
    { label: "Followers", val: followStats.followers },
    { label: "Following", val: followStats.following },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {!isOwnProfile && (
        <button 
          type="button" 
          onClick={onBack} 
          className="btn-ghost" 
          style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 10 }}
        >
          ← Back
        </button>
      )}
      {loadingTarget ? (
        <GooeyLoader size="medium" text="Loading profile..." />
      ) : (
        <>
          {isTargetAdmin && (
            <div style={{ padding: "14px 18px", borderRadius: "var(--radius)", background: "var(--cream3)", color: "var(--text)", marginBottom: 20, fontSize: 13 }}>
              <strong>Super Admin</strong> — Approvals & Stats display only. Profile is display-only.
            </div>
          )}

          {/* Banner & Avatar Profile Card */}
          <div className="glass-panel" style={{ overflow: "hidden", marginBottom: 24, position: "relative" }}>
            <div style={{
              backgroundImage: displayUser.banner ? `url(${displayUser.banner})` : "linear-gradient(135deg, rgba(111, 78, 55, 0.15), rgba(255,255,255,0.8))",
              backgroundSize: "cover", backgroundPosition: "center", height: 160, position: "relative"
            }}>
              {!isTargetAdmin && isOwnProfile && (
                <label className="btn-ghost" style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", padding: 0 }}>
                  <span style={{ fontSize: 14 }}>{bannerBusy ? "⏳" : "📷"}</span>
                  <input type="file" accept="image/*" disabled={bannerBusy} style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBannerFile(f); }} />
                </label>
              )}
            </div>

            <div style={{ padding: "0 28px 24px", position: "relative" }}>
              <div style={{ position: "relative", marginTop: -45, marginBottom: 16, width: 90, height: 90, zIndex: 5 }}>
                <div className="avatar" style={{ width: "100%", height: "100%", fontSize: 28, border: "4px solid var(--white-solid)" }}>
                  {displayUser.avatar && String(displayUser.avatar).startsWith("http") ? (
                    <img src={displayUser.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    initials(displayUser.name || "U")
                  )}
                </div>
                {!isTargetAdmin && isOwnProfile && (
                  <label className="btn-primary" style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", padding: 0, border: "2px solid #fff" }}>
                    <span style={{ fontSize: 10 }}>{avatarBusy ? "⏳" : "📷"}</span>
                    <input type="file" accept="image/*" disabled={avatarBusy} style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatarFile(f); }} />
                  </label>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ position: "absolute", top: 20, right: 28, display: "flex", gap: 10 }}>
                {!isTargetAdmin && isOwnProfile && (
                  <button type="button" onClick={async () => { if (editing) await saveProfile(); setEditing(!editing); }} className="btn-ghost">
                    {editing ? "Save Details" : "Edit Profile"}
                  </button>
                )}
                {!isTargetAdmin && isOwnProfile && isTargetStudent && (
                  <button onClick={() => setProfileData(p => ({ ...p, openToInternship: !p.openToInternship }))}
                    className="tag" style={{ cursor: "pointer", background: profileData.openToInternship ? "rgba(26,122,74,0.12)" : "var(--cream2)", color: profileData.openToInternship ? "#1A7A4A" : "var(--muted)" }}>
                    {profileData.openToInternship ? "✓ Open to Internship" : "Open to Intership?"}
                  </button>
                )}
                {!isOwnProfile && (
                  <>
                    <button type="button" onClick={handleFollowToggle} className="btn-primary" style={{ background: displayUser.followers?.includes(user.id) ? "var(--cream3)" : "var(--brown3)", color: displayUser.followers?.includes(user.id) ? "var(--text)" : "#fff" }}>
                      {displayUser.followers?.includes(user.id) ? "✓ Following" : "Follow"}
                    </button>
                    <button type="button" onClick={() => onStartDM?.(profileUserId)} className="btn-ghost">Message</button>
                  </>
                )}
              </div>

              <div style={{ fontSize: 24, fontWeight: 750, color: "var(--brown4)", marginBottom: 4 }}>{displayUser.name}</div>
              
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 12 }}>
                {isTargetRecruiter ? (
                  <>
                    <span style={{ color: "var(--brown3)", fontWeight: 600 }}>{profileData.recruiterTitle || displayUser.recruiterTitle || "Recruiter"}</span>
                    {profileData.university || displayUser.university ? ` at ${profileData.university || displayUser.university}` : ""}
                  </>
                ) : isTargetStudent ? (
                  <>
                    <span style={{ color: "var(--brown3)", fontWeight: 600 }}>{profileData.degree || displayUser.degree || "Student"}</span>
                    {profileData.university || displayUser.university ? ` at ${profileData.university || displayUser.university}` : ""}
                  </>
                ) : (
                  "Administrator"
                )}
              </div>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                {(profileData.countryResidence || displayUser.countryResidence) && <span>📍 {profileData.countryResidence || displayUser.countryResidence}</span>}
                {isTargetStudent && displayUser.targetCountry && <span>🎯 Target Study: {displayUser.targetCountry}</span>}
                <span>@{displayUser.handle}</span>
              </div>

              {/* Social Links */}
              {(profileData.linkedin || profileData.github || profileData.website) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {profileData.linkedin && <a href={profileData.linkedin.startsWith("http") ? profileData.linkedin : `https://${profileData.linkedin}`} target="_blank" rel="noreferrer" className="tag">🔗 LinkedIn</a>}
                  {profileData.github && <a href={profileData.github.startsWith("http") ? profileData.github : `https://${profileData.github}`} target="_blank" rel="noreferrer" className="tag">💻 GitHub</a>}
                  {profileData.website && <a href={profileData.website.startsWith("http") ? profileData.website : `https://${profileData.website}`} target="_blank" rel="noreferrer" className="tag">🌐 Portfolio</a>}
                </div>
              )}

              {isTargetRecruiter && (profileData.workEmail || displayUser.email) && (
                <div style={{ fontSize: 13, marginBottom: 14 }}>Work: <strong>{profileData.workEmail || displayUser.workEmail || displayUser.email}</strong></div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
                {stats.map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--brown4)" }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {editing && (
            <div className="glass-panel" style={{ padding: "24px 28px", marginBottom: 24 }}>
              <h3 style={{ borderLeft: "4px solid var(--brown1)", paddingLeft: 10 }}>Edit Details</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[["Bio","bio",true],["Skills","skills"],["LinkedIn URL","linkedin"],["GitHub URL","github"],["Portfolio URL","website"]].map(([lbl,key,isArea])=>(
                  <div key={key}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>{lbl}</label>
                    {isArea ? (
                      <textarea value={profileData[key]} onChange={e=>setProfileData(p=>({...p,[key]:e.target.value}))} className="glass-input" rows={3} />
                    ) : (
                      <input value={profileData[key]} onChange={e=>setProfileData(p=>({...p,[key]:e.target.value}))} className="glass-input" />
                    )}
                  </div>
                ))}

                {isTargetStudent && (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Degree level</label>
                      <select className="glass-select" value={profileData.degree} onChange={e=>setProfileData(p=>({...p,degree:e.target.value}))}>
                        <option value="">Select degree level...</option>
                        {DEGREES.map(d=>(<option key={d} value={d}>{d}</option>))}
                      </select>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Country of residence</label>
                      <select className="glass-select" value={profileData.countryResidence} onChange={e=>setProfileData(p=>({...p,countryResidence:e.target.value}))}>
                        <option value="">Select country...</option>
                        {COUNTRIES.map(c=>(<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                  </>
                )}

                {isTargetRecruiter && (
                  <>
                    <div style={{ marginBottom: 14 }}><label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Work email</label><input className="glass-input" type="email" value={profileData.workEmail} onChange={e=>setProfileData(p=>({...p,workEmail:e.target.value}))} /></div>
                    <div style={{ marginBottom: 14 }}><label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Company Name</label><input className="glass-input" value={profileData.university} onChange={e=>setProfileData(p=>({...p,university:e.target.value}))} /></div>
                  </>
                )}

                {isTargetStudent && (
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>CV / Resume PDF</label>
                    <label className="btn-ghost" style={{ cursor: cvBusy ? "wait" : "pointer" }}>
                      {cvBusy ? "Uploading…" : profileData.cvUploaded ? "📄 Replace CV" : "📤 Upload CV"}
                      <input type="file" accept=".pdf" disabled={cvBusy} style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadCvFile(f); }} />
                    </label>
                  </div>
                )}

              </div>
            </div>
          )}

          {!editing && (
            <>
              <div className="glass-panel" style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ borderLeft: "4px solid var(--brown1)", paddingLeft: 10 }}>Bio</h3>
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{profileData.bio || "No bio added yet."}</p>
              </div>

              {profileData.skills && (
                <div className="glass-panel" style={{ padding: 24, marginBottom: 24 }}>
                  <h3 style={{ borderLeft: "4px solid var(--brown1)", paddingLeft: 10 }}>Skills</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {profileData.skills.split(",").map(s => (<span key={s} className="tag">{s.trim()}</span>))}
                  </div>
                </div>
              )}

              {isTargetStudent && profileData.cvUploaded && displayUser.cvUrl && (
                <div className="glass-panel" style={{ padding: 20, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: 0 }}>CV / Resume on file</h4>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Used for direct scholarship/internship applies</p>
                  </div>
                  <a href={displayUser.cvUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ textDecoration: "none" }}>View CV →</a>
                </div>
              )}
            </>
          )}

          {/* Navigation Profile Tabs */}
          {(() => {
            const displayNav = isOwnProfile
              ? (isTargetRecruiter
                ? [["interests", "Focus"]]
                : isTargetAdmin
                ? [["posts", "Activity"]]
                : [["posts", "My Posts"], ["saved", "Saved"], ["interests", "Interests"]])
              : (isTargetRecruiter
                ? [["interests", "Focus"]]
                : [["posts", "Posts"], ["interests", "Interests"]]);

            return (
              <>
                <div className="sliding-nav-container" style={{ width: "fit-content", marginBottom: 20 }}>
                  {displayNav.map(([k, l]) => (
                    <button key={k} onClick={() => setTab(k)} className={`sliding-nav-btn ${tab === k ? "active" : ""}`}>{l}</button>
                  ))}
                </div>

                <div className="glass-panel" style={{ padding: tab === "interests" ? 0 : 20, border: tab === "interests" ? "none" : "1px solid var(--border)" }}>
                  {tab === "posts" && (
                    myPosts.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No posts yet.</div> : myPosts.map(p => <MiniPost key={p.id} post={p} />)
                  )}
                  {tab === "saved" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <div>
                        <h4 style={{ color: "var(--brown4)", borderBottom: "2px solid var(--cream3)", paddingBottom: 6, marginBottom: 12, fontSize: 15 }}>Saved Posts</h4>
                        {savedPostsLoading ? (
                          <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading saved posts...</div>
                        ) : savedPosts.length === 0 ? (
                          <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No saved posts yet.</div>
                        ) : (
                          savedPosts.map(p => <MiniPost key={p.id} post={p} onUnsave={handleUnsavePost} />)
                        )}
                      </div>
                      <div>
                        <h4 style={{ color: "var(--brown4)", borderBottom: "2px solid var(--cream3)", paddingBottom: 6, marginBottom: 12, fontSize: 15 }}>Saved Internships & Scholarships</h4>
                        {savedAppsLoading ? (
                          <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading saved opportunities...</div>
                        ) : savedApps.length === 0 ? (
                          <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No saved opportunities yet.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {savedApps.map(app => {
                              const details = app.item_details;
                              if (!details) return null;
                              const isScholarship = app.item_type === "scholarship";
                              const isJob = app.item_type === "job_posting";
                              
                              return (
                                <div key={app._id} className="glass-panel" style={{ padding: 16, position: "relative", border: "1px solid var(--border)", background: "rgba(255,255,255,0.4)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                      <span className="tag" style={{ fontSize: 9, marginBottom: 6 }}>
                                        {app.item_type.toUpperCase()}
                                      </span>
                                      <h5 style={{ margin: "4px 0", fontSize: 16, color: "var(--brown4)" }}>
                                        {details.title}
                                      </h5>
                                      <p style={{ margin: "2px 0", fontSize: 12, color: "var(--muted)" }}>
                                        {isScholarship ? details.university || details.country : (isJob ? details.company_name : details.company)}
                                      </p>
                                    </div>
                                    <button 
                                      type="button" 
                                      className="btn-ghost" 
                                      style={{ padding: "4px 8px", fontSize: 11, borderRadius: 8, color: "var(--brown3)" }}
                                      onClick={async () => {
                                        if (confirm("Unsave this opportunity?")) {
                                          await fetch(`${API_BASE}/applications/${app._id}`, {
                                            method: "DELETE",
                                            headers: { Authorization: `Bearer ${token}` }
                                          });
                                          loadSavedApps();
                                        }
                                      }}
                                    >
                                      Unsave
                                    </button>
                                  </div>
                                  
                                  {details.description && (
                                    <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                      {details.description}
                                    </p>
                                  )}
                                  {details.eligibility && (
                                    <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                      {details.eligibility}
                                    </p>
                                  )}

                                  <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                                    {details.apply_url && (
                                      <a href={details.apply_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: "4px 10px", fontSize: 11, textDecoration: "none", borderRadius: 8 }}>
                                        Apply Link →
                                      </a>
                                    )}
                                    {isJob && (
                                      <div style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center" }}>
                                        Apply via <strong>Jobs & apply</strong> tab
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {tab === "interests" && (
                    <div className="glass-panel" style={{ padding: 24 }}>
                      <h3>{isTargetRecruiter ? "Hiring Focus" : "Scholarship Interests"}</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {((isTargetRecruiter
                          ? (displayUser.hiringFocus?.length ? displayUser.hiringFocus : displayUser.interests)
                          : displayUser.interests) || ["STEM"]).map(i => (<span key={i} className="tag">{i}</span>))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

// ==========================================
// 12. RECRUITER WORKFLOW
// ==========================================

export function RecruiterOverview({ token }) {
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/recruiter/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || "Unable to load");
        setDash(d);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const m = dash?.metrics || {};
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h2>Recruiting overview</h2>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>Manage job posts and student conversations centrally.</p>
      {error && <div style={{ padding: 12, background: "var(--cream3)", color: "var(--brown3)", borderRadius: 10 }}>{error}</div>}
      
      {loading ? (
        <GooeyLoader size="medium" text="Loading overview..." />
      ) : dash ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Active job postings", val: m.active_job_postings },
              { label: "Total applicants", val: m.total_applicants ?? 0 },
              { label: "New applicants (7d)", val: m.new_applicants_this_week },
              { label: "Shortlisted", val: m.shortlisted },
            ].map((box) => (
              <div key={box.label} className="glass-panel" style={{ padding: 22, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--brown4)" }}>{box.val}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{box.label}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: 22, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 10px" }}>{dash.company.display_name}</h3>
            <div style={{ fontSize: 15 }}>
              <div style={{ color: "var(--muted)" }}>{dash.company.industry}{dash.company.recruiter_title ? ` · ${dash.company.recruiter_title}` : ""}</div>
              {(dash.company.hiring_focus || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  Hiring Focus: {dash.company.hiring_focus.map((h) => (<span key={h} className="tag" style={{ marginRight: 6 }}>{h}</span>))}
                </div>
              )}
            </div>
          </div>
          <ul style={{ paddingLeft: 18, fontSize: 14, color: "var(--text)", lineHeight: 1.8 }}>
            {(dash.tips || []).map((t, idx) => (<li key={idx}>{t}</li>))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

const getCvCategory = (score) => {
  if (score >= 70) return { label: "Best", color: "#1A7A4A", bg: "#E6F9F0" };
  if (score >= 45) return { label: "Medium", color: "#8A5A2D", bg: "#FFF6E8" };
  return { label: "Below", color: "#8A2E25", bg: "#FCEBE9" };
};

export function RecruiterJobsPane({ token, showComposer = true }) {
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [applicantsByJob, setApplicantsByJob] = useState({});
  const [loadingApps, setLoadingApps] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [reviewMsg, setReviewMsg] = useState({});
  const [categoryFilters, setCategoryFilters] = useState({});
  
  const [form, setForm] = useState({
    title: "", description: "", employment_type: "Internship", location_type: "Hybrid",
    location: "", apply_how: "", field: "", skills: "", required_keywords: "",
    preferred_keywords: "", minimum_cv_score: "45", auto_hide_irrelevant_cvs: true, deadline: "",
  });

  const load = async () => {
    const r = await fetch(`${API_BASE}/recruiter/jobs/me`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    setJobs(Array.isArray(d.jobs) ? d.jobs : []);
  };

  useEffect(() => {
    load();
  }, [token]);

  const fetchApplicants = async (jobId) => {
    setLoadingApps(jobId);
    try {
      const r = await fetch(`${API_BASE}/recruiter/jobs/${jobId}/applications?show_hidden=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Unable to load applicants.");
      setApplicantsByJob((prev) => ({ ...prev, [jobId]: d.applications || [] }));
    } catch {
      setApplicantsByJob((prev) => ({ ...prev, [jobId]: [] }));
    } finally {
      setLoadingApps(null);
    }
  };

  const toggleApplicants = (jobId) => {
    if (expanded === jobId) {
      setExpanded(null);
      return;
    }
    setExpanded(jobId);
    if (!applicantsByJob[jobId]) fetchApplicants(jobId);
  };

  const reviewApplication = async (applicationId, status) => {
    setReviewing(applicationId);
    setReviewMsg((prev) => ({ ...prev, [applicationId]: "" }));
    try {
      const r = await fetch(`${API_BASE}/recruiter/applications/${applicationId}/review`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ review_status: status }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Review update failed.");
      setReviewMsg((prev) => ({ ...prev, [applicationId]: "Updated." }));
      const jobId = Object.keys(applicantsByJob).find((jobKey) =>
        (applicantsByJob[jobKey] || []).some((app) => app._id === applicationId)
      );
      if (jobId) fetchApplicants(jobId);
    } catch (e) {
      setReviewMsg((prev) => ({ ...prev, [applicationId]: e.message || "Error" }));
    } finally {
      setReviewing(null);
    }
  };

  const submit = async () => {
    setBusy(true);
    setMsg("");
    try {
      const skills_keywords = form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const deadline = form.deadline ? new Date(form.deadline).toISOString() : null;
      const required_keywords = form.required_keywords ? form.required_keywords.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const preferred_keywords = form.preferred_keywords ? form.preferred_keywords.split(",").map((s) => s.trim()).filter(Boolean) : [];
      
      const r = await fetch(`${API_BASE}/recruiter/jobs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, description: form.description, employment_type: form.employment_type,
          location_type: form.location_type, location: form.location || null, apply_how: form.apply_how,
          field: form.field || null, skills_keywords, required_keywords, preferred_keywords,
          minimum_cv_score: Number(form.minimum_cv_score) || 45, auto_hide_irrelevant_cvs: form.auto_hide_irrelevant_cvs, deadline,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Publish failed.");
      setForm({
        title: "", description: "", field: "", employment_type: "Internship", location_type: "Hybrid",
        location: "", apply_how: "", skills: "", required_keywords: "", preferred_keywords: "",
        minimum_cv_score: "45", auto_hide_irrelevant_cvs: true, deadline: "",
      });
      setMsg("Job published successfully!");
      load();
    } catch (e) {
      setMsg(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Archive this posting?")) return;
    await fetch(`${API_BASE}/recruiter/jobs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {showComposer && (
        <>
          <h2>Post internships & jobs</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>Students submit CVs per job role. Linked postings show in Feed.</p>
          <div className="glass-panel" style={{ padding: 22, marginBottom: 26 }}>
            {[
              ["Job title", "title", "text"],
              ["Description", "description", "textarea"],
              ["Field / discipline", "field", "text"],
              ["Employment type", "employment_type", "text"],
              ["Location mode", "location_type", "text"],
              ["Office / region", "location", "text"],
              ["How to apply", "apply_how", "textarea"],
              ["Skills keywords (comma-separated)", "skills", "text"],
              ["Required keywords (comma-separated)", "required_keywords", "text"],
              ["Preferred keywords (comma-separated)", "preferred_keywords", "text"],
              ["Minimum CV score to show", "minimum_cv_score", "number"],
              ["Deadline (optional)", "deadline", "datetime-local"],
            ].map(([lbl, f, typ]) => (
              <div key={f} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>{lbl}</label>
                {typ === "textarea" ? (
                  <textarea rows={3} value={form[f]} onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))} className="glass-input" />
                ) : (
                  <input type={typ} value={form[f]} onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))} className="glass-input" />
                )}
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={form.auto_hide_irrelevant_cvs} onChange={(e) => setForm((prev) => ({ ...prev, auto_hide_irrelevant_cvs: e.target.checked }))} style={{ marginRight: 8 }} />
                Hide irrelevant CVs automatically
              </label>
            </div>
            {msg && <div style={{ marginBottom: 12, fontSize: 13, color: msg.includes("Error") ? "#8A2E25" : "#1A7A4A" }}>{msg}</div>}
            <button type="button" disabled={busy} onClick={submit} className="btn-primary">Publish role</button>
          </div>
        </>
      )}

      {jobs.map((j) => (
        <div key={j._id} className="glass-panel" style={{ padding: 18, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontSize: 18, margin: 0 }}>{j.title}</h3>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{j.employment_type} · {j.location_type} {j.location ? `· ${j.location}` : ""}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brown3)", marginTop: 6 }}>{j.application_count ?? 0} applied</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => toggleApplicants(j._id)}>{expanded === j._id ? "Hide" : "View"} Applicants</button>
              <button type="button" className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => remove(j._id)}>Archive</button>
            </div>
          </div>
          <p style={{ fontSize: 14, marginTop: 10, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{j.description}</p>
          
          {expanded === j._id && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>Filter Applicants by Category:</label>
                <select 
                  value={categoryFilters[j._id] || "All"} 
                  onChange={(e) => setCategoryFilters(prev => ({ ...prev, [j._id]: e.target.value }))}
                  className="glass-input"
                  style={{ width: "auto", padding: "6px 24px 6px 12px", fontSize: 12, height: "auto" }}
                >
                  <option value="All">All Categories (Auto-filtered)</option>
                  <option value="AllRaw">All Categories (Including Hidden)</option>
                  <option value="Best">Best Category (Score ≥ 70)</option>
                  <option value="Medium">Medium Category (Score 45-69)</option>
                  <option value="Below">Below Category (Score &lt; 45)</option>
                </select>
              </div>

              {loadingApps === j._id ? (
                <GooeyLoader size="small" text="Loading applicants..." />
              ) : (() => {
                const rawApps = applicantsByJob[j._id] || [];
                const filter = categoryFilters[j._id] || "All";
                const minScore = j.minimum_cv_score ?? 45;
                const autoHide = j.auto_hide_irrelevant_cvs ?? true;

                const filtered = rawApps.filter((app) => {
                  const score = app.cv_score ?? 0;
                  if (filter === "Best") return score >= 70;
                  if (filter === "Medium") return score >= 45 && score < 70;
                  if (filter === "Below") return score < 45;
                  if (filter === "All") {
                    if (autoHide) return score >= minScore;
                  }
                  return true; // AllRaw
                });

                if (filtered.length === 0) {
                  return <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>No applicants match this category filter.</div>;
                }

                return filtered.map((app) => {
                  const category = getCvCategory(app.cv_score ?? 0);
                  return (
                    <div key={app._id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 0", borderBottom: "1px solid var(--cream3)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                            {app.applicant?.name || "Applicant"}
                            <span className="tag" style={{ background: category.bg, color: category.color, fontSize: 10, fontWeight: 600, padding: "2px 6px" }}>
                              {category.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{app.applicant?.email}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Review: {app.review_status || "n/a"}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {app.cv_url && <a href={app.cv_url} target="_blank" rel="noreferrer" className="tag" style={{ textDecoration: "none" }}>Open CV →</a>}
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Score: {app.cv_score ?? "—"} (Match: {app.cv_match_status || "—"})</div>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button type="button" className="btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => reviewApplication(app._id, "manual_shortlisted")}>Shortlist</button>
                        <button type="button" className="btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => reviewApplication(app._id, "manual_rejected")}>Reject</button>
                      </div>
                      {reviewMsg[app._id] && <div style={{ fontSize: 11, color: "#1A7A4A", marginTop: 4 }}>{reviewMsg[app._id]}</div>}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function RecruiterApplicantsPane({ token }) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h2>Applicants & CVs</h2>
      <p style={{ color: "var(--muted)", marginBottom: 22 }}>Review PDF CVs submitted by student applicants below.</p>
      <RecruiterJobsPane token={token} showComposer={false} />
    </div>
  );
}

// ==========================================
// 13. ADMINISTRATOR WORKFLOW
// ==========================================

export function AdminSection({ token }) {
  const [pendingRecruiters, setPendingRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchPending = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/pending`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to fetch");
      setPendingRecruiters(Array.isArray(data.recruiters) ? data.recruiters : []);
    } catch (err) {
      setError(err.message);
      setPendingRecruiters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPending();
  }, [token]);

  const handleAction = async (recruiterId, action) => {
    if (!recruiterId) return;
    setMessage("");
    setError("");
    setActionLoading(`${action}-${recruiterId}`);
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/${recruiterId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || `Failed to ${action}`);
      setMessage(`Recruiter ${action === "approve" ? "approved" : "rejected"} successfully.`);
      await fetchPending();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h2>Admin Panel</h2>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>Review recruiter accounts to verify registration details.</p>
      {message && <div style={{ padding: 14, borderRadius: 10, background: "var(--cream2)", color: "var(--brown4)", marginBottom: 20 }}>{message}</div>}
      {error && <div style={{ padding: 14, borderRadius: 10, background: "var(--cream3)", color: "var(--brown4)", marginBottom: 20 }}>{error}</div>}

      <div className="glass-panel" style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 16px" }}>Pending Recruiters</h3>
        {loading ? (
          <GooeyLoader size="medium" text="Loading pending recruiters..." />
        ) : pendingRecruiters.length === 0 ? (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>No pending recruiters.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingRecruiters.map((rec) => {
              const recruiterId = rec._id || rec.id;
              return (
                <div key={recruiterId || rec.email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, background: "var(--cream)", borderRadius: 12, border: "1px solid var(--border)", gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--brown4)" }}>{rec.name || "Recruiter"}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{rec.email}</div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => handleAction(recruiterId, "approve")} disabled={!!actionLoading} className="btn-primary" style={{ padding: "8px 16px", background: "#1A7A4A" }}>
                      {actionLoading === `approve-${recruiterId}` ? "..." : "Approve"}
                    </button>
                    <button onClick={() => handleAction(recruiterId, "reject")} disabled={!!actionLoading} className="btn-ghost" style={{ padding: "8px 16px", color: "#A32D2D" }}>
                      {actionLoading === `reject-${recruiterId}` ? "..." : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminDashboard({ token }) {
  const [activeTab, setActiveTab] = useState("pending_recruiters");
  const [pendingRecruiters, setPendingRecruiters] = useState([]);
  const [approvedRecruiters, setApprovedRecruiters] = useState([]);
  const [allRecruiters, setAllRecruiters] = useState([]);
  const [stats, setStats] = useState({ total_users: 0, total_recruiters: 0, pending_recruiters: 0, total_students: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [actionInProgress, setActionInProgress] = useState(null);

  const fetchPendingRecruiters = async () => {
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/pending`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      setPendingRecruiters(data.recruiters || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchApprovedRecruiters = async () => {
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/approved`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      setApprovedRecruiters(data.recruiters || []);
    } catch {}
  };

  const fetchAllRecruiters = async () => {
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/all`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      setAllRecruiters(data.recruiters || []);
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const resp = await fetch(`${API_BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) {
        const data = await resp.json();
        setStats(data);
      }
    } catch {}
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPendingRecruiters(), fetchApprovedRecruiters(), fetchAllRecruiters(), fetchStats()])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleAction = async (recruiterId, action) => {
    setMessage("");
    setError("");
    setActionInProgress(recruiterId);
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/${recruiterId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed");
      setMessage(`Recruiter ${action}ed successfully.`);
      fetchPendingRecruiters();
      fetchApprovedRecruiters();
      fetchAllRecruiters();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const RecruiterCard = ({ rec, showActions = false, action = null }) => (
    <div className="glass-panel" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{rec.name} {action && <span className="tag" style={{ marginLeft: 6 }}>{action}</span>}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{rec.email}</div>
      </div>
      {showActions && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleAction(rec._id, "approve")} disabled={actionInProgress === rec._id} className="btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>Approve</button>
          <button onClick={() => handleAction(rec._id, "reject")} disabled={actionInProgress === rec._id} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>Reject</button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <h2>Admin Dashboard</h2>
      
      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Total Users</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.total_users}</div>
        </div>
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Total Recruiters</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.total_recruiters}</div>
        </div>
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Pending Review</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.pending_recruiters}</div>
        </div>
      </div>

      {message && <div style={{ padding: 14, borderRadius: 10, background: "var(--cream2)", marginBottom: 20 }}>{message}</div>}
      {error && <div style={{ padding: 14, borderRadius: 10, background: "var(--cream3)", marginBottom: 20 }}>{error}</div>}

      <div className="sliding-nav-container" style={{ width: "fit-content", marginBottom: 20 }}>
        {["pending_recruiters", "approved_recruiters", "all_recruiters", "analytics"].map((id) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`sliding-nav-btn ${activeTab === id ? "active" : ""}`}>{id.replace("_", " ")}</button>
        ))}
      </div>

      {activeTab === "pending_recruiters" && (
        <div>
          <h3>Pending Recruiters</h3>
          {loading ? <GooeyLoader size="medium" text="Loading pending recruiters..." /> : pendingRecruiters.length === 0 ? <div style={{ color: "var(--muted)", padding: 20 }}>All applications approved!</div> : pendingRecruiters.map(r => <RecruiterCard key={r._id} rec={r} showActions />)}
        </div>
      )}

      {activeTab === "approved_recruiters" && (
        <div>
          <h3>Approved Recruiters</h3>
          {loading ? <GooeyLoader size="medium" text="Loading approved recruiters..." /> : approvedRecruiters.length === 0 ? <div style={{ color: "var(--muted)", padding: 20 }}>No approved recruiters yet.</div> : approvedRecruiters.map(r => <RecruiterCard key={r._id} rec={r} action="approved" />)}
        </div>
      )}

      {activeTab === "all_recruiters" && (
        <div>
          <h3>All Recruiters</h3>
          {loading ? <GooeyLoader size="medium" text="Loading recruiters..." /> : allRecruiters.length === 0 ? <div style={{ color: "var(--muted)", padding: 20 }}>No recruiters found.</div> : allRecruiters.map(r => <RecruiterCard key={r._id} rec={r} action={r.status} />)}
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="glass-panel" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
          <h4>Advanced stats dashboard</h4>
          <p>Charts, student growth curves, and application metrics coming in next update.</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 14. SETTINGS DROPDOWN COMPONENT
// ==========================================

export function SettingsDropdown({ theme, setTheme, onDeleteAccount, user, token }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  // Password change states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Password visibility states
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsDetailsOpen(false);
        setShowPasswordForm(false);
        resetPasswordForm();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetPasswordForm = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/users/${user.id}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        })
      });

      const data = await resp.json();
      if (resp.ok) {
        setPasswordSuccess("Password updated successfully!");
        setTimeout(() => {
          setShowPasswordForm(false);
          resetPasswordForm();
        }, 1500);
      } else {
        setPasswordError(data.detail || "Failed to update password");
      }
    } catch (err) {
      console.error(err);
      setPasswordError("Network error. Try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="glass-select-button settings-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "rgba(255, 255, 255, 0.06)",
          color: "var(--text)",
          fontWeight: "600",
          cursor: "pointer",
          fontSize: "13px"
        }}
      >
        <span className="settings-gear-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "transform 0.4s ease" }}><SettingsIcon /></span> Settings
      </button>

      {isOpen && (
        <div
          className="settings-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 250,
            backgroundColor: "var(--white-solid)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            boxShadow: "var(--shadow-lg)",
            padding: "16px",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          {/* Theme selection block */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brown3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              App Theme
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { id: "light", icon: <SunIcon />, label: "Light Mode" },
                { id: "dark", icon: <MoonIcon />, label: "Dark Mode" },
                { id: "brown-cream", icon: <CoffeeIcon />, label: "Brown & Cream" },
                { id: "neon-black", icon: <LightningIcon />, label: "Purple" }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: theme === t.id ? "var(--brown3)" : "var(--border)",
                    background: theme === t.id ? "var(--accent-bg)" : "transparent",
                    color: theme === t.id ? "var(--brown3)" : "var(--text)",
                    fontWeight: theme === t.id ? "600" : "400",
                    cursor: "pointer",
                    fontSize: "13px",
                    textAlign: "left"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {t.icon}
                    {t.label}
                  </span>
                  {theme === t.id && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

          {/* Account Details block */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brown3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Account Settings
            </div>
            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "var(--text)",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserIcon /> Account details
              </span>
              <span style={{ 
                transform: isDetailsOpen ? "rotate(180deg)" : "rotate(0deg)", 
                transition: "transform 0.2s ease" 
              }}>▼</span>
            </button>

            {isDetailsOpen && (
              <div
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: "10px",
                  background: "var(--cream)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  animation: "animate-fade-in 0.2s ease"
                }}
              >
                {!showPasswordForm ? (
                  <>
                    {/* Account Details Content */}
                    <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 2 }}>
                      <div><strong>Email:</strong> {user.email}</div>
                      <div><strong>Role:</strong> {user.userType || "Student"}</div>
                      {user.handle && <div><strong>Handle:</strong> @{user.handle}</div>}
                    </div>

                    <div style={{ borderTop: "1px solid var(--border)", margin: "2px 0" }} />

                    {/* Change password button Option */}
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(true)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--text)",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontSize: "12px",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--accent-bg)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <SettingsLockIcon /> Change password
                    </button>

                    {/* Delete account Option */}
                    <button
                      type="button"
                      onClick={onDeleteAccount}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(138, 46, 37, 0.18)";
                        e.currentTarget.style.color = "#ff4a4a";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(138, 46, 37, 0.08)";
                        e.currentTarget.style.color = "#ff6b6b";
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #8A2E25",
                        background: "rgba(138, 46, 37, 0.08)",
                        color: "#ff6b6b",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.2s ease"
                      }}
                    >
                      <WarningIcon /> Delete account
                    </button>
                  </>
                ) : (
                  /* Password Change Form Section */
                  <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brown4)" }}>Change Password</span>
                      <button 
                        type="button" 
                        onClick={() => { setShowPasswordForm(false); resetPasswordForm(); }}
                        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11, padding: 0 }}
                      >
                        ← Back
                      </button>
                    </div>

                    <div style={{ position: "relative", width: "100%" }}>
                      <input 
                        type={showOldPassword ? "text" : "password"} 
                        placeholder="Current password" 
                        value={oldPassword}
                        onChange={e => setOldPassword(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 32px 6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          background: "var(--cream2)",
                          color: "var(--text-h)",
                          fontSize: "12px",
                          outline: "none"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "var(--muted)",
                          display: "flex",
                          alignItems: "center"
                        }}
                      >
                        {showOldPassword ? (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>

                    <div style={{ position: "relative", width: "100%" }}>
                      <input 
                        type={showNewPassword ? "text" : "password"} 
                        placeholder="New password" 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 32px 6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          background: "var(--cream2)",
                          color: "var(--text-h)",
                          fontSize: "12px",
                          outline: "none"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "var(--muted)",
                          display: "flex",
                          alignItems: "center"
                        }}
                      >
                        {showNewPassword ? (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>

                    <div style={{ position: "relative", width: "100%" }}>
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder="Confirm new password" 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 32px 6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          background: "var(--cream2)",
                          color: "var(--text-h)",
                          fontSize: "12px",
                          outline: "none"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "var(--muted)",
                          display: "flex",
                          alignItems: "center"
                        }}
                      >
                        {showConfirmPassword ? (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>

                    {passwordError && (
                      <div style={{ color: "#ff6b6b", fontSize: 11, textAlign: "center", fontWeight: "600" }}>
                        ⚠️ {passwordError}
                      </div>
                    )}

                    {passwordSuccess && (
                      <div style={{ color: "var(--brown3)", fontSize: 11, textAlign: "center", fontWeight: "600" }}>
                        ✓ {passwordSuccess}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={passwordLoading}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--brown3)",
                        background: "var(--brown3)",
                        color: "var(--white-solid)",
                        fontWeight: "600",
                        cursor: passwordLoading ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        textAlign: "center",
                        opacity: passwordLoading ? 0.7 : 1
                      }}
                    >
                      {passwordLoading ? "Updating..." : "Update Password"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 15. MAIN DASHBOARD APPLICATION SHELL
// ==========================================

export function Dashboard({ user, token, onLogout, onUserRefresh, theme, setTheme }) {
  const [tab, setTab] = useState("news");
  const [allPosts, setAllPosts] = useState([]);
  const [profileUserId, setProfileUserId] = useState(null);
  const [activeRecipientId, setActiveRecipientId] = useState(null);

  const role = user?.userType || "student";

  useEffect(() => {
    if (role === "recruiter") setTab("overview");
    else if (role === "super_admin") setTab("admin");
    else setTab("news");
  }, [role]);

  const onViewUserProfile = (userId) => {
    setProfileUserId(userId);
    setTab("profile");
  };

  const onStartDM = (userId) => {
    setActiveRecipientId(userId);
    setTab("messages");
  };

  const studentNav = useMemo(() => [
    ["news", <FeedIcon />, "Feed"], ["jobs", <JobsIcon />, "Jobs & apply"], ["matches", <MatchesIcon />, "Matches"],
    ["chat", <ChatIcon />, "AI chat"], ["guides", <GuidesIcon />, "Guides"], ["messages", <MessagesIcon />, "Messages"], ["profile", <ProfileIcon />, "Profile"]
  ], []);

  const recruiterNav = useMemo(() => [
    ["overview", <OverviewIcon />, "Overview"], ["community", <FeedIcon />, "Community"], ["postings", <JobsIcon />, "Post roles"],
    ["applicants", <ApplicantsIcon />, "Applicants"], ["messages", <MessagesIcon />, "Messages"], ["profile", <ProfileIcon />, "Profile"]
  ], []);

  const adminNav = useMemo(() => [
    ["admin", <ApprovalsIcon />, "Approvals"], ["analytics", <AnalyticsIcon />, "Insights"], ["profile", <ProfileIcon />, "Profile"]
  ], []);

  const nav = role === "recruiter" ? recruiterNav : role === "super_admin" ? adminNav : studentNav;

  // Header Nav active slider measurement
  const navRef = useRef(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector(".sliding-nav-btn.active");
    if (activeBtn) {
      setPillStyle({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth });
    }
  }, [tab, nav]);

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to permanently delete your account? This action will erase all your profile details, posts, applications, and messages, and cannot be undone.")) {
      try {
        const resp = await fetch(`${API_BASE}/users/${user.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          alert("Account successfully deleted.");
          onLogout();
        } else {
          const err = await resp.json();
          alert(`Error: ${err.detail || "Could not delete account"}`);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to delete account. Please try again.");
      }
    }
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="app-top">
        <div className="app-brand">SCHLR</div>
        
        <div ref={navRef} className="sliding-nav-container" aria-label="Main">
          <div className="sliding-nav-pill" style={{ "--pill-left": `${pillStyle.left}px`, "--pill-width": `${pillStyle.width}px` }} />
          {nav.map(([id, icon, label]) => (
            <button key={id} type="button" className={`sliding-nav-btn ${tab === id ? "active" : ""}`}
              onClick={() => {
                if (id === "profile") setProfileUserId(null);
                if (id === "messages") setActiveRecipientId(null);
                setTab(id);
              }}>
              <span className="nav-icon" style={{ marginRight: 6, display: "inline-block", transition: "transform 0.2s ease" }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SettingsDropdown 
            theme={theme} 
            setTheme={setTheme} 
            onDeleteAccount={handleDeleteAccount} 
            user={user} 
            token={token}
          />
          
          <span style={{ fontSize: 13, color: "var(--muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.name}
          </span>
          <button type="button" className="btn-ghost logout-btn" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => setShowLogoutConfirm(true)}>
            <span className="logout-icon" style={{ marginRight: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s ease" }}><LogoutIcon /></span> Log out
          </button>
        </div>
      </header>

      <main key={tab} className="app-main animate-fade-in-up">
        {role === "student" && (
          <>
            {tab === "news" && <NewsSection user={user} token={token} onPostsUpdated={setAllPosts} onViewUserProfile={onViewUserProfile} />}
            {tab === "jobs" && <StudentJobsSection user={user} token={token} />}
            {tab === "matches" && <MatchesSection token={token} user={user} />}
            {tab === "chat" && <ChatSection user={user} token={token} />}
            {tab === "guides" && <GuidesSection />}
            {tab === "messages" && <MessagingSection user={user} token={token} activeRecipientId={activeRecipientId} onViewUserProfile={onViewUserProfile} />}
            {tab === "profile" && <ProfileSection user={user} allPosts={allPosts} token={token} onUserRefresh={onUserRefresh} profileUserId={profileUserId} onStartDM={onStartDM} />}
          </>
        )}

        {role === "recruiter" && (
          <>
            {tab === "overview" && <RecruiterOverview token={token} />}
            {tab === "community" && <NewsSection user={user} token={token} onPostsUpdated={setAllPosts} feedVariant="recruiter" onViewUserProfile={onViewUserProfile} />}
            {tab === "postings" && <RecruiterJobsPane token={token} />}
            {tab === "applicants" && <RecruiterApplicantsPane token={token} />}
            {tab === "messages" && <MessagingSection user={user} token={token} activeRecipientId={activeRecipientId} onViewUserProfile={onViewUserProfile} />}
            {tab === "profile" && <ProfileSection user={user} allPosts={[]} token={token} onUserRefresh={onUserRefresh} profileUserId={profileUserId} onStartDM={onStartDM} />}
          </>
        )}

        {role === "super_admin" && (
          <>
            {tab === "admin" && <AdminSection token={token} />}
            {tab === "analytics" && <AdminDashboard token={token} />}
            {tab === "profile" && <ProfileSection user={user} allPosts={allPosts} token={token} onUserRefresh={onUserRefresh} profileUserId={profileUserId} onStartDM={onStartDM} />}
          </>
        )}
      </main>

      {/* Logout Confirmation Modal Overlay */}
      {showLogoutConfirm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          animation: "fade-in 0.25s ease"
        }}
        onClick={() => setShowLogoutConfirm(false)}
        >
          <div style={{
            background: "var(--white-solid)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "24px 32px",
            width: "90%",
            maxWidth: "400px",
            boxShadow: "var(--shadow-lg)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            transform: "scale(1)",
            animation: "modal-zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
          }}
          onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "center", color: "#8A2E25", padding: "8px 0" }}>
              <LogoutIcon width="48" height="48" strokeWidth="2" />
            </div>
            <h3 style={{ fontSize: "20px", color: "var(--text-h)", margin: 0, fontWeight: "750" }}>
              Confirm Log Out
            </h3>
            <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to log out of your SCHLR account? You will need to sign back in to access your recommendations and feed.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button 
                className="btn-ghost" 
                style={{ flex: 1, padding: "12px 18px", borderRadius: "12px", border: "1px solid var(--border)" }}
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, padding: "12px 18px", borderRadius: "12px", background: "#8A2E25", borderColor: "#8A2E25", color: "#fff" }}
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 15. MAIN ENTRY POINT
// ==========================================

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("schlr_token") || "");
  const [bootLoading, setBootLoading] = useState(true);
  const [authView, setAuthView] = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  
  // Theme management: defaults to system preferences, supports manual toggle override
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("schlr_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("schlr_theme", theme);
  }, [theme]);

  const handleToken = (value) => {
    setToken(value);
    localStorage.setItem("schlr_token", value);
  };
  
  const handleLogout = () => {
    localStorage.removeItem("schlr_token");
    setToken("");
    setUser(null);
    setAuthView("landing");
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const me = await resp.json();
      const u = mapMeToUser(me);
      if (u) setUser(u);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!token) {
        setBootLoading(false);
        return;
      }
      try {
        const resp = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error("Session expired");
        const me = await resp.json();
        setUser(mapMeToUser(me));
      } catch {
        localStorage.removeItem("schlr_token");
        setToken("");
        setUser(null);
      } finally {
        setBootLoading(false);
      }
    };
    bootstrapSession();
  }, [token]);

  if (bootLoading) {
    return (
      <div className="splash-container">
        <h1 className="splash-logo">SCHLR</h1>
        <div className="splash-subtitle">Scholarship Community</div>
        <GooeyLoader size="large" />
      </div>
    );
  }

  if (!user && authView === "landing") {
    return <LandingPage onChoose={(mode) => { setAuthMode(mode); setAuthView("auth"); }} />;
  }
  
  if (!user) {
    return <AuthPage onLogin={setUser} onAuthToken={handleToken} initialMode={authMode} onBack={() => setAuthView("landing")} />;
  }
  
  return (
    <Dashboard
      user={user}
      token={token}
      onLogout={handleLogout}
      onUserRefresh={refreshUser}
      theme={theme}
      setTheme={setTheme}
    />
  );
}
