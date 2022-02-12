import * as dotenv from "dotenv";
import hre from "hardhat";
import { CryptoCocks } from "../typechain";
import { addWhitelistedContracts } from "../test/helper";
dotenv.config();

async function main() {
  const CONTRACT_ADDRESS = "0x76285B02D778D06813f9C287640C35f82041B4a1";
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
