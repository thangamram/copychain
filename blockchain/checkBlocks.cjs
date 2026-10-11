const { ethers } = require("hardhat");

async function main() {
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log("Current block number on node:", blockNumber);
  
  for (let i = 1; i <= blockNumber; i++) {
    const b = await ethers.provider.getBlock(i);
    console.log(`Block #${i} (${new Date(b.timestamp * 1000).toLocaleTimeString()}): ${b.transactions.length} txs`);
    for (const txHash of b.transactions) {
      const tx = await ethers.provider.getTransaction(txHash);
      console.log(`  -> Hash: ${tx.hash} | From: ${tx.from} | To: ${tx.to}`);
    }
  }
}

main().catch(console.error);
