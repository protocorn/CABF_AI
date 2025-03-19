import { useState } from 'react';

export default function AddDocument() {
    const [files, setFiles] = useState([]);
    const [message, setMessage] = useState('');

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
        setMessage(`${selectedFiles.length} file(s) added`);
    };

    const removeFile = (indexToRemove) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (files.length === 0) {
            setMessage('Please select at least one file');
            return;
        }

        // Here you would typically handle the files upload to your backend
        setMessage(`Ready to upload ${files.length} file(s)`);
        // Add your files upload logic here
    };

    return (
        <div className="container">
            <h1>Upload Documents</h1>
            <form onSubmit={handleSubmit}>
                <div className="upload-section">
                    <label htmlFor="document">Select documents to upload:</label>
                    <input
                        type="file"
                        id="document"
                        onChange={handleFileChange}
                        className="file-input"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.ppt,.pptx"
                    />
                </div>

                {files.length > 0 && (
                    <div className="selected-files">
                        <h3>Selected Files:</h3>
                        <ul>
                            {files.map((file, index) => (
                                <li key={`${file.name}-${index}`}>
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                    <button 
                                        type="button" 
                                        className="remove-button"
                                        onClick={() => removeFile(index)}
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {message && <p className="message">{message}</p>}
                <button 
                    type="submit" 
                    className="submit-button"
                    disabled={files.length === 0}
                >
                    Upload {files.length} {files.length === 1 ? 'Document' : 'Documents'}
                </button>
            </form>

            <style jsx>{`
                .container {
                    max-width: 600px;
                    margin: 2rem auto;
                    padding: 1.5rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                h1 {
                    color: #333;
                    margin-bottom: 1.5rem;
                }

                .upload-section {
                    margin-bottom: 1.5rem;
                }

                label {
                    display: block;
                    margin-bottom: 0.5rem;
                    color: #555;
                }

                .file-input {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }

                .selected-files {
                    margin: 1rem 0;
                    padding: 1rem;
                    border: 1px solid #eee;
                    border-radius: 4px;
                }

                .selected-files h3 {
                    margin: 0 0 0.5rem 0;
                    color: #444;
                }

                .selected-files ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .selected-files li {
                    display: flex;
                    align-items: center;
                    padding: 0.5rem;
                    border-bottom: 1px solid #eee;
                }

                .selected-files li:last-child {
                    border-bottom: none;
                }

                .file-name {
                    flex: 1;
                    margin-right: 1rem;
                }

                .file-size {
                    color: #666;
                    font-size: 0.9rem;
                    margin-right: 1rem;
                }

                .remove-button {
                    background: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                }

                .remove-button:hover {
                    background: #cc0000;
                }

                .message {
                    margin: 1rem 0;
                    padding: 0.5rem;
                    color: #666;
                }

                .submit-button {
                    background-color: #0070f3;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: background-color 0.2s;
                }

                .submit-button:hover {
                    background-color: #0051cc;
                }

                .submit-button:disabled {
                    background-color: #ccc;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
} 