const { ethers } = require("hardhat");

async function main() {
  const r = await ethers.getContractAt('CopyrightRegistry', '0x5FbDB2315678afecb367f032d93F642f64180aa3');
  const [deployer] = await ethers.getSigners();
  console.log("Connected signer:", deployer.address);

  const blockNumber = await ethers.provider.getBlockNumber();
  for (let i = 1; i <= blockNumber; i++) {
    const b = await ethers.provider.getBlock(i, true);
    for (const tx of b.prefetchedTransactions) {
      console.log(`Block #${i} Tx: ${tx.hash}`);
      console.log(`  To: ${tx.to}`);
      console.log(`  Data: ${tx.data.slice(0, 10)}`);
      const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
      console.log(`  Logs count: ${receipt.logs.length}`);
      for (const log of receipt.logs) {
        try {
          const parsed = r.interface.parseLog(log);
          console.log(`  Parsed Event: ${parsed.name}`);
          console.log(`    Args:`, parsed.args);
        } catch (e) {
          console.log(`  Unparsed Log from: ${log.address}`);
        }
      }
    }
  }
}

main().catch(console.error);
