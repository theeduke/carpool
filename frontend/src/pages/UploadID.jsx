import React, { useState } from "react";
import { useSelector } from "react-redux";

const UploadID = () => {
    const [idFront, setIdFront] = useState(null);
    const [idBack, setIdBack] = useState(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const token = useSelector((state) => state.auth.token);

    const handleFileChange = (e, setFile) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!idFront || !idBack) {
            setError("Please upload both front and back images of your ID.");
            return;
        }

        const formData = new FormData();
        formData.append("id_front", idFront);
        formData.append("id_back", idBack);

        try {
            const response = await fetch("/api/upload-id/", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to upload ID images.");
            }

            setMessage(data.message);
            setError("");
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="upload-id">
            <h2>Upload ID Images</h2>
            <label>ID Front:</label>
            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setIdFront)} />
            
            <label>ID Back:</label>
            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setIdBack)} />

            <button onClick={handleUpload}>Upload</button>

            {message && <p className="success-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}
        </div>
    );
};

export default UploadID;
