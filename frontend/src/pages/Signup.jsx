import { Link, useNavigate } from "react-router-dom";

function Signup() {
  const navigate = useNavigate();

  const handleSignup = () => {
    // Later we will call backend API here
    navigate("/");
  };

  return (
    <div className="app">
      <div className="card">
        <h1>Signup</h1>

        <input type="text" placeholder="Full name" />
        <input type="email" placeholder="Email" />
        <input type="password" placeholder="Password" />

        <button onClick={handleSignup}>Signup</button>

        <p>
          Already have an account?
          <Link to="/login"> Login</Link>
        </p>

        <p>
          <Link to="/">Back to Dashboard</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;