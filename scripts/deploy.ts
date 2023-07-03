import { ethers } from "hardhat";

async function main() {

  const dao = await ethers.deployContract("Dao");

  await dao.waitForDeployment();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
