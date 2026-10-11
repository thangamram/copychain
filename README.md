# CopyChain

A Decentralized Copyright Protection and Digital Content Licensing Platform.

## Project Structure
- `blockchain/`: Contains Hardhat setup, Solidity smart contracts (`CopyrightRegistry`, `ContentLicensing`), and tests.
- `backend/`: Node.js, Express, and MongoDB backend for indexing and off-chain metadata (e.g. infringement reports).
- `frontend/`: React, Vite, and Tailwind CSS frontend application.

## Prerequisites
- Node.js (v18+)
- MongoDB (running locally on port 27017 or update `backend/.env` to point to Atlas)
- MetaMask browser extension

## Setup & Run Instructions

### 1. Smart Contracts
```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat test      # Run the test suite
npx hardhat node      # Start a local blockchain (keep this terminal open)
```
*(In a separate terminal, deploy the contracts)*:
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

### 2. Backend Server
```bash
cd backend
npm install
# Ensure MongoDB is running, or the backend will start without DB connection for demo purposes
node index.js
```

### 3. Frontend Application
```bash
cd frontend
npm install
npm run dev
```

## Usage
1. Open the frontend URL (usually `http://localhost:5173`).
2. Connect MetaMask to the local Hardhat network (`http://localhost:8545`, Chain ID: 31337).
3. Import one of the Hardhat accounts into MetaMask using the private key provided in the Hardhat console.
4. Use the **Register** tab to upload a file and record its SHA-256 fingerprint on the blockchain.
5. Use the **Verify** tab to check if a specific file's exact hash exists in the registry.

## Disclaimer
Blockchain registration provides an immutable, timestamped record of a content fingerprint linked to a specific wallet. **It does not independently establish legal copyright ownership.**
