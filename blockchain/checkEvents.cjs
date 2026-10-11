const { ethers } = require("hardhat");

async function main() {
  const REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const CopyrightRegistry = await ethers.getContractFactory("CopyrightRegistry");
  const registry = CopyrightRegistry.attach(REGISTRY_ADDRESS);
  
  console.log("Checking events...");
  const filter = registry.filters.ContentRegistered();
  const logs = await registry.queryFilter(filter, 0, "latest");
  
  console.log(`Found ${logs.length} registered works.`);
  logs.forEach((log, index) => {
    console.log(`${index + 1}. Hash: ${log.args[0]}, Owner: ${log.args[1]}`);
  });
}

main().catch(console.error);
