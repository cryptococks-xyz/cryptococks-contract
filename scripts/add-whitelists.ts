import * as dotenv from "dotenv";
import hre from "hardhat";
import { CryptoCocks } from "../typechain";
import { addWhitelistedContracts } from "../test/helper";
dotenv.config();

async function main() {
  const CONTRACT_ADDRESS = "0x2aDcfaFb356F0942B8432C036dDA41F6C0d2877F";
  const cryptoCocks: CryptoCocks = await hre.ethers.getContractAt(
    "CryptoCocks",
    CONTRACT_ADDRESS
  );
  addWhitelistedContracts(cryptoCocks, true).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
