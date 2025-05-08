import React, { useState } from "react";
import { useSelector } from "react-redux";

const UploadSmartDL = () => {
    const [smartDL, setSmartDL] = useState(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const token = useSelector((state) => state.auth.token);

    const handleFileChange = (e) => {
        setSmartDL(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!smartDL) {
            setError("Please upload your Smart DL.");
            return;
        }

        const formData = new FormData();
        formData.append("smart_dl", smartDL);

        try {
            const response = await fetch("/api/upload-smart-dl/", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to upload Smart DL.");
            }

            setMessage(data.message);
            setError("");
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="upload-smart-dl">
            <h2>Upload Smart DL</h2>
            <label>Smart DL:</label>
            <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} />

            <button onClick={handleUpload}>Upload</button>

            {message && <p className="success-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}
        </div>
    );
};

export default UploadSmartDL;
