const { ethers } = require("hardhat");

async function main() {
  const LICENSING_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const ContentLicensing = await ethers.getContractFactory("ContentLicensing");
  const licensing = ContentLicensing.attach(LICENSING_ADDRESS);
  
  console.log("Checking listings...");
  const filter = licensing.filters.ListingCreated();
  const logs = await licensing.queryFilter(filter, 0, "latest");
  
  console.log(`Found ${logs.length} listings.`);
  logs.forEach((log, index) => {
    console.log(`${index + 1}. ContentId: ${log.args[0]}, Price: ${log.args[1]}`);
  });
}

main().catch(console.error);
