import { Link } from "react-router-dom";

const Missing = () => {
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
            fontSize: "4rem",
            color: "#e74c3c",
            marginBottom: "1rem",
            margin: "0",
          }}
        >
          404
        </h1>
        <h2
          style={{
            color: "#2c3e50",
            marginBottom: "1rem",
          }}
        >
          Page Not Found
        </h2>
        <p
          style={{
            color: "#7f8c8d",
            marginBottom: "2rem",
            fontSize: "1.1rem",
          }}
        >
          Sorry, the page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#667eea",
            color: "white",
            textDecoration: "none",
            borderRadius: "5px",
            fontWeight: "600",
            transition: "background-color 0.3s",
          }}
        >
          Go Home
        </Link>
      </div>
    </article>
  );
};

export default Missing;
