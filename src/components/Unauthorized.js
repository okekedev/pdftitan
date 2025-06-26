import { useNavigate } from "react-router-dom";

const Unauthorized = () => {
  const navigate = useNavigate();

  const goBack = () => navigate(-1);

  return (
    <article
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "3rem",
          borderRadius: "10px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
          textAlign: "center",
          maxWidth: "500px",
        }}
      >
        <h1
          style={{
            fontSize: "3rem",
            color: "#e74c3c",
            marginBottom: "1rem",
          }}
        >
          Unauthorized
        </h1>
        <h2
          style={{
            color: "#2c3e50",
            marginBottom: "1rem",
          }}
        >
          Access Denied
        </h2>
        <p
          style={{
            color: "#7f8c8d",
            marginBottom: "2rem",
            fontSize: "1.1rem",
          }}
        >
          You do not have permission to view this page.
        </p>
        <button
          onClick={goBack}
          style={{
            padding: "12px 24px",
            backgroundColor: "#667eea",
            color: "white",
            border: "none",
            borderRadius: "5px",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "1rem",
            transition: "background-color 0.3s",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#5a67d8")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "#667eea")}
        >
          Go Back
        </button>
      </div>
    </article>
  );
};

export default Unauthorized;
