import { useNavigate, Link } from "react-router-dom";
import { useContext } from "react";
import AuthContext from "../context/AuthProvider";
import useLogout from "../hooks/useLogout";

const Home = () => {
  const { auth } = useContext(AuthContext);
  const logout = useLogout();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <section
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "white",
            borderRadius: "10px",
            padding: "2rem",
            marginBottom: "2rem",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                color: "#2c3e50",
                margin: "0 0 0.5rem 0",
                fontSize: "2rem",
              }}
            >
              PDFTitan Dashboard
            </h1>
            <p
              style={{
                color: "#7f8c8d",
                margin: "0",
                fontSize: "1.1rem",
              }}
            >
              Welcome back, {auth?.user}!
            </p>
          </div>
          <button
            onClick={signOut}
            style={{
              padding: "10px 20px",
              backgroundColor: "#e74c3c",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Main Content */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "2rem",
          }}
        >
          {/* Quick Actions */}
          <div
            style={{
              background: "white",
              borderRadius: "10px",
              padding: "2rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2
              style={{
                color: "#2c3e50",
                marginBottom: "1.5rem",
                fontSize: "1.5rem",
              }}
            >
              Quick Actions
            </h2>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <Link
                to="/projects"
                style={{
                  display: "block",
                  padding: "15px 20px",
                  backgroundColor: "#3498db",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "5px",
                  textAlign: "center",
                  fontWeight: "600",
                  transition: "background-color 0.3s",
                }}
              >
                📋 View Projects
              </Link>
              <Link
                to="/editor"
                style={{
                  display: "block",
                  padding: "15px 20px",
                  backgroundColor: "#f39c12",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "5px",
                  textAlign: "center",
                  fontWeight: "600",
                  transition: "background-color 0.3s",
                }}
              >
                ✏️ PDF Editor
              </Link>
              <Link
                to="/jobs"
                style={{
                  display: "block",
                  padding: "15px 20px",
                  backgroundColor: "#27ae60",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "5px",
                  textAlign: "center",
                  fontWeight: "600",
                  transition: "background-color 0.3s",
                }}
              >
                👷 My Jobs
              </Link>
            </div>
          </div>

          {/* User Info */}
          <div
            style={{
              background: "white",
              borderRadius: "10px",
              padding: "2rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2
              style={{
                color: "#2c3e50",
                marginBottom: "1.5rem",
                fontSize: "1.5rem",
              }}
            >
              Account Information
            </h2>
            <div style={{ color: "#7f8c8d", lineHeight: "1.8" }}>
              <p>
                <strong>Username:</strong> {auth?.user}
              </p>
              <p>
                <strong>Roles:</strong> {auth?.roles?.join(", ")}
              </p>
              <p>
                <strong>Access Level:</strong>{" "}
                {auth?.roles?.includes(5150)
                  ? "Administrator"
                  : auth?.roles?.includes(1984)
                  ? "Editor"
                  : auth?.roles?.includes(2001)
                  ? "User"
                  : "Guest"}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <div
            style={{
              background: "white",
              borderRadius: "10px",
              padding: "2rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2
              style={{
                color: "#2c3e50",
                marginBottom: "1.5rem",
                fontSize: "1.5rem",
              }}
            >
              Available Pages
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <Link
                to="/linkpage"
                style={{ color: "#667eea", textDecoration: "none" }}
              >
                📄 Link Page
              </Link>
              {auth?.roles?.includes(1984) && (
                <Link
                  to="/editor"
                  style={{ color: "#667eea", textDecoration: "none" }}
                >
                  ✏️ Editor (Editor+ Only)
                </Link>
              )}
              {auth?.roles?.includes(5150) && (
                <Link
                  to="/admin"
                  style={{ color: "#667eea", textDecoration: "none" }}
                >
                  ⚙️ Admin (Admin Only)
                </Link>
              )}
              {auth?.roles?.find((role) => [1984, 5150].includes(role)) && (
                <Link
                  to="/lounge"
                  style={{ color: "#667eea", textDecoration: "none" }}
                >
                  🏖️ Lounge (Editor+ Only)
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;
