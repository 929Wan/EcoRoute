import { useState } from "react";

function UI() {
  const [isOpen, setIsOpen] = useState(true);
  const [numBuses, setNumBuses] = useState(10);
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);

  return (
    <>
    <button
      onClick={() => setIsOpen(!isOpen)}
      style={{
        position: "fixed",
        top: "20px",
        left: isOpen ? "300px" : "20px",
        backgroundColor: "#10b981",
        border: "none",
        color: "white",
        fontSize: "24px",
        cursor: "pointer",
        zIndex: 1001,
        padding: "8px 12px",
        borderRadius: "6px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        transition: "left 0.3s ease"
      }}
    >
      <div style={{ width: "24px", height: "2px", backgroundColor: "white" }}></div>
      <div style={{ width: "24px", height: "2px", backgroundColor: "white" }}></div>
      <div style={{ width: "24px", height: "2px", backgroundColor: "white" }}></div>
    </button>
    <div style={{
    backgroundColor: "#FCFBFA",
    padding: "24px",
    paddingTop: "20px",
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: "320px",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    transform: isOpen ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.3s ease",
    visibility: isOpen ? "visible" : "hidden"
  }}>
    
    <h2 style={{
      fontSize: "45px",
      fontWeight: "800",
      color: "#10b981",
      margin: 0,
      marginTop: "-20px",
      marginBottom: "24px",
      letterSpacing: "0.5px",
      fontFamily: "'Segoe UI', 'Helvetica', sans-serif"
    }}>
      ECOROUTE
    </h2>
    <div style={{ marginTop: "10px" }}>
  <label
    style={{
      fontSize: "28px",
      fontWeight: "700",
      marginBottom: "8px",
      display: "block",
      color: "#10b981",
      fontFamily: "'Segoe UI', 'Helvetica', sans-serif",
      letterSpacing: "0.5px"
    }}
  >
    Buses
  </label>

  <input
    type="number"
    min="1"
    value={numBuses}
    onChange={(e) => setNumBuses(parseInt(e.target.value) || 1)}
    style={{
      width: "100%",
      padding: "8px",
      borderRadius: "6px",
      border: "1px solid #10b981",
      fontSize: "14px",
      boxSizing: "border-box"
    }}
  />
</div>

    <button
      onClick={() => setIsBubbleOpen(!isBubbleOpen)}
      style={{
        padding: "12px 16px",
        marginTop: "120px",
        backgroundColor: "#10b981",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "15px",
        fontWeight: "600",
        width: "100%"
      }}
    >
      {isBubbleOpen ? "Close" : "Add"} Addresses
    </button>

    {isBubbleOpen && (
      <div style={{
        position: "fixed",
        top: "228px",
        left: isOpen ? "380px" : "150px",
        width: "300px",
        backgroundColor: "#f0fdf4",
        border: "2px solid #10b981",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        animation: "slideRight 0.3s ease-out",
        maxHeight: "500px",
        overflowY: "auto",
        zIndex: 999
      }}>
        <button
          onClick={() => setIsBubbleOpen(false)}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            backgroundColor: "transparent",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
            color: "#10b981",
            padding: "4px 8px"
          }}
        >
          ×
        </button>
        
        <h3 style={{
          margin: "0 0 12px 0",
          color: "#10b981",
          fontSize: "28px",
          fontWeight: "700",
          fontFamily: "'Segoe UI', 'Helvetica', sans-serif",
          letterSpacing: "0.5px"
        }}>
          Addresses
        </h3>
        
        <input
          type="text"
          placeholder="Enter address"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && addressInput.trim()) {
              setAddresses([...addresses, addressInput]);
              setAddressInput("");
            }
          }}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #10b981",
            fontSize: "14px",
            marginBottom: "8px",
            boxSizing: "border-box"
          }}
        />
        
        <button
          onClick={() => {
            if (addressInput.trim()) {
              setAddresses([...addresses, addressInput]);
              setAddressInput("");
            }
          }}
          style={{
            width: "100%",
            padding: "8px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            marginBottom: "12px",
            fontWeight: "600"
          }}
        >
          Add Address
        </button>
        
        {addresses.length > 0 && (
          <div style={{
            marginBottom: "16px",
            padding: "8px",
            backgroundColor: "white",
            borderRadius: "6px",
            border: "1px solid #d1fae5",
            maxHeight: "200px",
            overflowY: "auto"
          }}>
            {addresses.map((address, index) => (
              <div key={index} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: index < addresses.length - 1 ? "1px solid #e5e7eb" : "none",
                fontSize: "13px",
                color: "#333"
              }}>
                <span>{address}</span>
                <button
                  onClick={() => setAddresses(addresses.filter((_, i) => i !== index))}
                  style={{
                    backgroundColor: "#fee2e2",
                    color: "#dc2626",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    padding: "2px 6px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        
        <hr style={{
          margin: "16px 0",
          border: "none",
          borderTop: "1px solid #d1fae5"
        }} />
        
        <h3 style={{
          margin: "0 0 12px 0",
          color: "#10b981",
          fontSize: "16px",
          fontWeight: "600"
        }}>
          Upload File
        </h3>
        
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setUploadedFile(e.target.files[0]);
            }
          }}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #10b981",
            fontSize: "14px",
            marginBottom: "8px",
            boxSizing: "border-box"
          }}
        />
        
        {uploadedFile && (
          <div style={{
            padding: "8px",
            backgroundColor: "#dbeafe",
            borderRadius: "6px",
            border: "1px solid #0ea5e9",
            marginBottom: "8px",
            fontSize: "13px",
            color: "#0369a1"
          }}>
            <strong>File:</strong> {uploadedFile.name}
          </div>
        )}
      </div>
    )} 
    <div
      style={{
        flex: 1,
        marginTop: "16px",
        backgroundColor: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
        minHeight: 0,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start"
      }}
    >
      <div
        style={{
          fontFamily: "'Segoe UI', 'Helvetica', sans-serif",
          fontSize: "28px",
          fontWeight: 700,
          color: "#10b981",
          textAlign: "center",
          marginTop: "14px",
          letterSpacing: "0.5px"
        }}
      >
        EcoData
      </div>

      {/* Route stats will go here */}
    </div>
  </div>

    <style>{`
      @keyframes slideRight {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `}</style>

    </>
  );
}

export default UI;