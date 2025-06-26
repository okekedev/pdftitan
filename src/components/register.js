import { useRef, useState, useEffect } from "react";
import {
  faCheck,
  faTimes,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "../api/axios";
import { Link } from "react-router-dom";

const USER_REGEX = /^[A-z][A-z0-9-_]{3,23}$/;
const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%]).{8,24}$/;
const REGISTER_URL = "/register";

const Register = () => {
  const userRef = useRef();
  const errRef = useRef();

  const [user, setUser] = useState("");
  const [validName, setValidName] = useState(false);
  const [userFocus, setUserFocus] = useState(false);

  const [pwd, setPwd] = useState("");
  const [validPwd, setValidPwd] = useState(false);
  const [pwdFocus, setPwdFocus] = useState(false);

  const [matchPwd, setMatchPwd] = useState("");
  const [validMatch, setValidMatch] = useState(false);
  const [matchFocus, setMatchFocus] = useState(false);

  const [errMsg, setErrMsg] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    userRef.current.focus();
  }, []);

  useEffect(() => {
    setValidName(USER_REGEX.test(user));
  }, [user]);

  useEffect(() => {
    setValidPwd(PWD_REGEX.test(pwd));
    setValidMatch(pwd === matchPwd);
  }, [pwd, matchPwd]);

  useEffect(() => {
    setErrMsg("");
  }, [user, pwd, matchPwd]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // if button enabled with JS hack
    const v1 = USER_REGEX.test(user);
    const v2 = PWD_REGEX.test(pwd);
    if (!v1 || !v2) {
      setErrMsg("Invalid Entry");
      return;
    }
    try {
      const response = await axios.post(
        REGISTER_URL,
        JSON.stringify({ user, pwd }),
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );
      console.log(response?.data);
      console.log(response?.accessToken);
      console.log(JSON.stringify(response));
      setSuccess(true);
      //clear state and controlled inputs
      //need value attrib on inputs for this
      setUser("");
      setPwd("");
      setMatchPwd("");
    } catch (err) {
      if (!err?.response) {
        setErrMsg("No Server Response");
      } else if (err.response?.status === 409) {
        setErrMsg("Username Taken");
      } else {
        setErrMsg("Registration Failed");
      }
      errRef.current.focus();
    }
  };

  return (
    <>
      {success ? (
        <section
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
              maxWidth: "400px",
            }}
          >
            <h1 style={{ color: "#27ae60", marginBottom: "1rem" }}>Success!</h1>
            <p style={{ marginBottom: "2rem", color: "#2c3e50" }}>
              Your account has been created successfully.
            </p>
            <Link
              to="/login"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                backgroundColor: "#667eea",
                color: "white",
                textDecoration: "none",
                borderRadius: "5px",
                fontWeight: "600",
              }}
            >
              Sign In
            </Link>
          </div>
        </section>
      ) : (
        <section
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
              width: "100%",
              maxWidth: "500px",
            }}
          >
            <p
              ref={errRef}
              className={errMsg ? "errmsg" : "offscreen"}
              aria-live="assertive"
              style={{
                color: "#e74c3c",
                marginBottom: "1rem",
                fontSize: "0.9rem",
              }}
            >
              {errMsg}
            </p>

            <h1
              style={{
                textAlign: "center",
                marginBottom: "2rem",
                color: "#2c3e50",
              }}
            >
              Register for PDFTitan
            </h1>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  htmlFor="username"
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "600",
                    color: "#2c3e50",
                  }}
                >
                  Username:
                  <span className={validName ? "valid" : "hide"}>✓</span>
                  <span className={validName || !user ? "hide" : "invalid"}>
                    ✗
                  </span>
                </label>
                <input
                  type="text"
                  id="username"
                  ref={userRef}
                  autoComplete="off"
                  onChange={(e) => setUser(e.target.value)}
                  value={user}
                  required
                  aria-invalid={validName ? "false" : "true"}
                  aria-describedby="uidnote"
                  onFocus={() => setUserFocus(true)}
                  onBlur={() => setUserFocus(false)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "5px",
                    fontSize: "1rem",
                  }}
                />
                <p
                  id="uidnote"
                  className={
                    userFocus && user && !validName
                      ? "instructions"
                      : "offscreen"
                  }
                  style={{
                    fontSize: "0.8rem",
                    color: "#7f8c8d",
                    marginTop: "0.5rem",
                  }}
                >
                  4 to 24 characters.
                  <br />
                  Must begin with a letter.
                  <br />
                  Letters, numbers, underscores, hyphens allowed.
                </p>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "600",
                    color: "#2c3e50",
                  }}
                >
                  Password:
                  <span className={validPwd ? "valid" : "hide"}>✓</span>
                  <span className={validPwd || !pwd ? "hide" : "invalid"}>
                    ✗
                  </span>
                </label>
                <input
                  type="password"
                  id="password"
                  onChange={(e) => setPwd(e.target.value)}
                  value={pwd}
                  required
                  aria-invalid={validPwd ? "false" : "true"}
                  aria-describedby="pwdnote"
                  onFocus={() => setPwdFocus(true)}
                  onBlur={() => setPwdFocus(false)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "5px",
                    fontSize: "1rem",
                  }}
                />
                <p
                  id="pwdnote"
                  className={
                    pwdFocus && !validPwd ? "instructions" : "offscreen"
                  }
                  style={{
                    fontSize: "0.8rem",
                    color: "#7f8c8d",
                    marginTop: "0.5rem",
                  }}
                >
                  8 to 24 characters.
                  <br />
                  Must include uppercase and lowercase letters, a number and a
                  special character.
                  <br />
                  Allowed special characters: ! @ # $ %
                </p>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  htmlFor="confirm_pwd"
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "600",
                    color: "#2c3e50",
                  }}
                >
                  Confirm Password:
                  <span className={validMatch && matchPwd ? "valid" : "hide"}>
                    ✓
                  </span>
                  <span
                    className={validMatch || !matchPwd ? "hide" : "invalid"}
                  >
                    ✗
                  </span>
                </label>
                <input
                  type="password"
                  id="confirm_pwd"
                  onChange={(e) => setMatchPwd(e.target.value)}
                  value={matchPwd}
                  required
                  aria-invalid={validMatch ? "false" : "true"}
                  aria-describedby="confirmnote"
                  onFocus={() => setMatchFocus(true)}
                  onBlur={() => setMatchFocus(false)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "5px",
                    fontSize: "1rem",
                  }}
                />
                <p
                  id="confirmnote"
                  className={
                    matchFocus && !validMatch ? "instructions" : "offscreen"
                  }
                  style={{
                    fontSize: "0.8rem",
                    color: "#7f8c8d",
                    marginTop: "0.5rem",
                  }}
                >
                  Must match the first password input field.
                </p>
              </div>

              <button
                disabled={!validName || !validPwd || !validMatch ? true : false}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor:
                    validName && validPwd && validMatch ? "#667eea" : "#bdc3c7",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  cursor:
                    validName && validPwd && validMatch
                      ? "pointer"
                      : "not-allowed",
                  marginBottom: "1rem",
                }}
              >
                Sign Up
              </button>
            </form>

            <p
              style={{
                textAlign: "center",
                color: "#7f8c8d",
                fontSize: "0.9rem",
              }}
            >
              Already registered?
              <br />
              <span className="line">
                <Link
                  to="/login"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontWeight: "600",
                  }}
                >
                  Sign In
                </Link>
              </span>
            </p>
          </div>
        </section>
      )}
    </>
  );
};

export default Register;
