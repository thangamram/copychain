const { ethers } = require("hardhat");

async function main() {
  const r = await ethers.getContractAt('CopyrightRegistry', '0x5FbDB2315678afecb367f032d93F642f64180aa3');
  const targetHash = '0x6d6fa8c885d437f560e576c9bd05e978f00d66a4801545c1c41fa1dffc3737cb';
  const isReg = await r.isRegistered(targetHash);
  console.log('Target hash isRegistered:', isReg);

  const blockNumber = await ethers.provider.getBlockNumber();
  console.log('Total blocks:', blockNumber);

  const filter = r.filters.ContentRegistered();
  const logs = await r.queryFilter(filter, 0, 'latest');
  console.log('ContentRegistered count:', logs.length);
  for (const l of logs) {
    console.log(' - Hash:', l.args[1], 'Creator:', l.args[2]);
  }

  const dFilter = r.filters.DerivativeRegistered();
  const dLogs = await r.queryFilter(dFilter, 0, 'latest');
  console.log('DerivativeRegistered count:', dLogs.length);
  for (const l of dLogs) {
    console.log(' - Deriv Hash:', l.args[2], 'Creator:', l.args[3]);
  }
}

main().catch(console.error);
