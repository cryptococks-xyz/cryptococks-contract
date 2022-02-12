import { CryptoCocks, TestToken } from "../typechain";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber, ContractTransaction, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PercentileDataEntry } from "./percentiles";

/**
 * Sets contract to free sale settings
 */
export async function setContractToFreeSale(
  contract: CryptoCocks,
  owner: Signer
) {
  await contract.connect(owner).changePublicSaleStatus(true);
  await contract.connect(owner).changeFeeSettings(true, 0, 0);
  const settings = await contract.set();

  // assert settings
  expect(settings.publicSaleStatus).to.equal(true);
  expect(settings.freeMinting).to.equal(true);
  expect(settings.percFee).to.equal(0);
  expect(settings.minFee).to.equal(0);
}

/**
 * Sets contract to private sale settings
 */
export async function setContractToPrivateSale(
  contract: CryptoCocks,
  owner: Signer
) {
  await contract.connect(owner).changePublicSaleStatus(false);
  await contract
    .connect(owner)
    .changeFeeSettings(false, 100, ethers.utils.parseEther("0.02"));
  const settings = await contract.set();

  // assert settings
  expect(settings.publicSaleStatus).to.equal(false);
  expect(settings.freeMinting).to.equal(false);
  expect(settings.percFee).to.equal(100);
  expect(settings.minFee).to.equal(ethers.utils.parseEther("0.02"));
}

/**
 * Sets contract to public sale settings
 */
export async function setContractToPublicSale(
  contract: CryptoCocks,
  owner: Signer
) {
  await contract.connect(owner).changePublicSaleStatus(true);
  await contract
    .connect(owner)
    .changeFeeSettings(false, 100, ethers.utils.parseEther("0.02"));
  const settings = await contract.set();

  // assert settings
  expect(settings.publicSaleStatus).to.equal(true);
  expect(settings.freeMinting).to.equal(false);
  expect(settings.percFee).to.equal(100);
  expect(settings.minFee).to.equal(ethers.utils.parseEther("0.02"));
}

/**
 * Return 1% of the signer's wallet balance or
 * when necessary a minimum of 0.02 Ether.
 *
 * @param signer Signer
 * @param percFee Fee [0, ...)
 */
export async function getMintValue(signer: Signer, percFee: number = 100) {
  if (percFee === 0) {
    return BigNumber.from(0);
  }

  const balance = await signer.getBalance();
  let value = balance.div(percFee); // 1% or 1/100 of balance
  if (!value.gte(ethers.utils.parseEther("0.02"))) {
    value = ethers.utils.parseEther("0.02"); // minimum of 0.02 Eth
  }
  return value;
}

/**
 * Adds a whitelisted community token contract and
 * asserts that everything went as supposed.
 *
 * @param cryptoCocks Deployed CryptoCocks contract
 * @param owner Owner account that deployed the CryptoCocks contract
 * @param tokenContractAddress TestToken contract
 * @param id
 * @param communityWalletAddress Signer
 * @param maxSupply Maximum supply
 * @param minBalance Minimum balance
 * @param percRoyal Percentage royalties
 * @param revert Expect the transaction to revert
 * @param assert
 */
export async function addWhitelistedContract(
  cryptoCocks: CryptoCocks,
  owner: Signer,
  tokenContractAddress: string,
  id: number,
  communityWalletAddress: string,
  maxSupply: number,
  minBalance: number,
  percRoyal: number,
  revert: boolean = false,
  assert: boolean = true
) {
  await _addWhitelistedContract(
    cryptoCocks,
    owner,
    tokenContractAddress,
    id,
    communityWalletAddress,
    maxSupply,
    minBalance,
    percRoyal,
    revert,
    undefined,
    assert
  );
}

export async function addWhitelistedERC1155Contract(
  cryptoCocks: CryptoCocks,
  owner: Signer,
  tokenContractAddress: string,
  id: number,
  erc1155Id: BigNumber,
  communityWalletAddress: string,
  maxSupply: number,
  minBalance: number,
  percRoyal: number,
  assert: boolean = true
) {
  await _addWhitelistedContract(
    cryptoCocks,
    owner,
    tokenContractAddress,
    id,
    communityWalletAddress,
    maxSupply,
    minBalance,
    percRoyal,
    false,
    erc1155Id,
    assert
  );
}

async function _addWhitelistedContract(
  cryptoCocks: CryptoCocks,
  owner: Signer,
  tokenContractAddress: string,
  id: number,
  communityWalletAddress: string,
  maxSupply: number,
  minBalance: number,
  percRoyal: number,
  revert: boolean,
  erc1155Id?: BigNumber,
  assert: boolean = true
) {
  const cc = tokenContractAddress;
  const wallet = communityWalletAddress;

  const isERC1155 = !!erc1155Id;

  if (revert) {
    const tx = cryptoCocks
      .connect(owner)
      .addWhiteListing(
        id,
        isERC1155,
        cc,
        wallet,
        maxSupply,
        minBalance,
        percRoyal,
        erc1155Id ?? 0
      );
    if (assert) {
      await expect(tx).to.be.reverted;
    } else {
      await tx;
    }
  } else {
    const tx = cryptoCocks
      .connect(owner)
      .addWhiteListing(
        id,
        isERC1155,
        cc,
        wallet,
        maxSupply,
        minBalance,
        percRoyal,
        erc1155Id ?? 0
      );
    if (assert) {
      await expect(tx).to.not.be.reverted;

      const whiteListed = await cryptoCocks.getListContract(id); // index starts with 0
      expect(whiteListed.percRoyal).to.equal(percRoyal);
      expect(whiteListed.maxSupply).to.equal(maxSupply);
      expect(whiteListed.minBalance).to.equal(minBalance);
      expect(whiteListed.tracker).to.equal(0);
      expect(whiteListed.balance.toNumber()).to.equal(0);
      expect(whiteListed.cc.toUpperCase()).to.equal(cc.toUpperCase());
      expect(whiteListed.wallet.toUpperCase()).to.equal(
        communityWalletAddress.toUpperCase()
      );
    } else {
      await tx;
    }
  }
}

/**
 * Mint test tokens for some wallet and
 * assert that everything worked as supposed
 *
 * @param signer Wallet that receives the test tokens
 * @param cryptoCocks Deployed CryptoCocks contract
 * @param testToken Deployed TestToken contract
 * @param listIndex Index in list of whitelisted contracts
 * @param times Number of tokens given to the signer
 */
export async function mintTestToken(
  signer: SignerWithAddress,
  cryptoCocks: CryptoCocks,
  testToken: TestToken,
  times: number
) {
  const receiptPromises = [...Array(times)].map(async () => {
    return testToken.connect(signer).mint(signer.address);
  });
  // wait for all transactions and then assert balance
  Promise.all(receiptPromises).then(async () => {
    const balance = await testToken.balanceOf(signer.address);
    expect(balance).to.equal(BigNumber.from(times));
  });
}

/**
 * Mint a token and assert that everything went as supposed
 *
 * @param cryptoCocks Deployed CryptoCocks contract
 * @param minter Signer that mints a token
 * @param percFee Fee Percentage that must equal the current setup in contract
 */
export async function mint(
  cryptoCocks: CryptoCocks,
  minter: SignerWithAddress,
  percFee: number = 100
) {
  const value = await getMintValue(minter, percFee);
  const pTx = cryptoCocks.connect(minter).mint({
    value,
  });
  await expect(() => pTx).to.changeEtherBalance(minter, value.mul(-1));
  await expect(pTx).to.not.be.reverted;
  return pTx;
}

/**
 * Mint a token but expect a transaction revert.
 *
 * @param cryptoCocks Deployed CryptoCocks contract
 * @param minter Signer that wants to mint a token
 * @param reason Transaction revert reason
 * @param percFee Fee Percentage that must equal the current setup in contract
 */
export async function mintRevert(
  cryptoCocks: CryptoCocks,
  minter: SignerWithAddress,
  reason: string = "LOCK",
  percFee: number = 100
) {
  const value = await getMintValue(minter, percFee);
  const pTx = cryptoCocks.connect(minter).mint({
    value,
  });
  await expect(pTx).to.be.revertedWith(reason);
}

/**
 * Assert cock length and token id by looking at the
 * emitted PermanentURI.
 *
 * @param cryptoCocks Deployed CryptoCocks contract
 * @param mintTx Mint transaction
 * @param length Expected cock length
 * @param tokenId Expected token id
 */
export async function expectToken(
  cryptoCocks: CryptoCocks,
  mintTx: ContractTransaction,
  length: string,
  tokenId: number,
  startToken: number
) {
  await expect(mintTx)
    .to.emit(cryptoCocks, "PermanentURI")
    .withArgs(
      `${length}_${tokenId + startToken}.json`,
      BigNumber.from(tokenId + startToken)
    );
}

export interface FeeSettings {
  freeMinting?: boolean;
  percFee?: number;
  minFee?: number;
}

/**
 * Gets a signer from the generated accounts
 * for the test network.
 */
export async function getMinter(
  signers: SignerWithAddress[],
  index: number,
  percentileData?: PercentileDataEntry[]
): Promise<SignerWithAddress> {
  const minter = signers[index];
  if (percentileData) {
    const wei = ethers.utils.parseEther(percentileData[index].balance);
    await setBalance(minter, wei);
    const balance = await minter.getBalance();
    expect(balance).to.equal(
      ethers.utils.parseEther(percentileData[index].balance)
    );
  }
  return minter;
}

/**
 * Updates the fee settings in the contract
 * by sending a changeFeeSettings transaction
 *
 * @param cryptoCocks Deployed CryptoCocks contract
 * @param owner Owner of CryptoCocks contract
 * @param feeSettings New Fee Settings
 */
export async function changeFeeSettings(
  cryptoCocks: CryptoCocks,
  owner: Signer,
  feeSettings: FeeSettings
) {
  const minFee = feeSettings.minFee ?? 0.02;
  const percFee = feeSettings.percFee ?? 100;
  await expect(
    cryptoCocks
      .connect(owner)
      .changeFeeSettings(
        feeSettings.freeMinting ?? false,
        percFee,
        ethers.utils.parseEther(minFee.toString())
      )
  ).to.not.be.reverted;
}

type BalanceType = "team" | "donation";

export async function assertCollectedBalance(
  cryptoCocks: CryptoCocks,
  balance: BigNumber,
  balanceType: BalanceType
) {
  const balances = await cryptoCocks.bal();
  expect(balances[balanceType]).to.equal(balance);
}

export interface CommunityTokenHolder {
  address: string; // wallet address holding a specific community token
  balance: string; // number of tokens held by the wallet
}

export interface CommunityTokenHolders {
  duckdao: CommunityTokenHolder;
  kryptonauten: CommunityTokenHolder;
  lobsterdao: CommunityTokenHolder;
  cyberkongz: CommunityTokenHolder;
  daomaker: CommunityTokenHolder;
  neotokyo: CommunityTokenHolder;
}

export async function assertBalanceOf(
  cryptoCocks: CryptoCocks,
  listIndex: number,
  communityTokenHolder: CommunityTokenHolder
) {
  const tx = cryptoCocks.queryBalance(listIndex, communityTokenHolder.address);
  await expect(tx).to.not.be.reverted;
  expect(await tx).to.equal(communityTokenHolder.balance);
}

const cids = [
  "bafybeiesbbihtfdj3kqbah5642p7drsb6hrzwzksezbgb2t2ojjwgh2k5m",
  "bafybeifclnruolpdcsouhmzhnardvpzroxk6qouc53drw4vh2f3zdoouya",
  "bafybeihbeszvaoc3exx6ji77g74nyuqmoz2scdykudna3qd6xzgygn36ra",
  "bafybeidl3uswhq65hnfvgj6bfahbvdb57y7cxiaelgct6q7raweubcms6u",
  "bafybeifx2hrh6mhbpcivo4z53l76uqwc6fth4nf4qah6aow7e62lcka3d4",
];

export function getCID(tokenId: number) {
  if (tokenId <= 2000) {
    return cids[0];
  } else if (tokenId <= 4000) {
    return cids[1];
  } else if (tokenId <= 6000) {
    return cids[2];
  } else if (tokenId <= 8000) {
    return cids[3];
  }
  return cids[4];
}

export async function setBalance(account: SignerWithAddress, wei: BigNumber) {
  // https://github.com/nomiclabs/hardhat/issues/1585#issuecomment-963277815
  const balance = wei.toHexString().replace(/0x0+/, "0x");
  await network.provider.send("hardhat_setBalance", [account.address, balance]);
}

export async function assertListContract(
  cryptoCocks: CryptoCocks,
  lcId: number,
  exists: boolean = true
) {
  const tx = cryptoCocks.getListContract(lcId);
  if (exists) {
    await expect(tx).to.not.be.reverted;
  } else {
    await expect(tx).to.be.revertedWith("LC_NOT_FOUND");
  }
}

const COMMUNITY_CONTRACTS = {
  kryptonauten: "0x5501f260c398b613f57c4c6be55fef41bd397c28",
  duckdao: "0xfbeea1c75e4c4465cb2fccc9c6d6afe984558e20",
  lobsterdao: "0x026224a2940bfe258d0dbe947919b62fe321f042",
  cyberkongz: "0x57a204AA1042f6E66DD7730813f4024114d74f37",
  daomaker: "0x0f51bb10119727a7e5eA3538074fb341F56B09Ad",
  neotokyo: "0xb668beB1Fa440F6cF2Da0399f8C28caB993Bdd65",
};

const COMMUNITY_WALLETS = {
  kryptonauten: "0x043dD28DEdAF4209E7aA7eD460E2A45e0915b7EB",
  duckdao: "0x81e26116ca697c9e832647aa678464c527c9F3Ec",
  lobsterdao: "0x557068a9b7d66f97a61b97c80541eb17672e1e6f",
  cyberkongz: "0x5b1f57449Dd479e787FDF201a59d06D3Cb84F5Dc",
  daomaker: "0x5b1f57449Dd479e787FDF201a59d06D3Cb84F5Dc",
  neotokyo: "0x5b1f57449Dd479e787FDF201a59d06D3Cb84F5Dc",
};

export const COMMUNITY_TOKEN_HOLDERS: CommunityTokenHolders = {
  kryptonauten: {
    address: "0x2755D9661081e82e125343A802C47cE5574ADfa5",
    balance: "1",
  },
  duckdao: {
    address: "0x229cbd1955fee93ab6e7876c1b17f6d0b859e953",
    balance: "246369320000000000000000",
  },
  lobsterdao: {
    address: "0x76778d62b680b64bf18632ae14af8411ce142ace",
    balance: "1",
  },
  cyberkongz: {
    address: "0x9279c4cfb0e85e2dff8825ce141f9794c7c7170a",
    balance: "63",
  },
  daomaker: {
    address: "0x3303ba184b5bca54bb519067b658261fd4142abe",
    balance: "34460450466670000000000",
  },
  neotokyo: {
    address: "0xbc2ff4a129dbd2063c2760713b801cbea639bd23",
    balance: "1",
  },
};

const MAX_SUPPLY = {
  kryptonauten: 400,
  duckdao: 250,
  lobsterdao: 150,
  cyberkongz: 100,
  daomaker: 50,
  neotokyo: 20,
};

const MIN_BALANCE = {
  kryptonauten: 1,
  duckdao: 100,
  lobsterdao: 1,
  cyberkongz: 5,
  daomaker: 300,
  neotokyo: 1,
};

const PERC_ROYAL = {
  kryptonauten: 10,
  duckdao: 5,
  lobsterdao: 3,
  cyberkongz: 2,
  daomaker: 0,
  neotokyo: 0,
};

export async function addWhitelistedContracts(
  cryptoCocks: CryptoCocks,
  debug: boolean = false
) {
  const owner = (await ethers.getSigners())[0];

  // Kryptonauten
  try {
    await addWhitelistedERC1155Contract(
      cryptoCocks,
      owner,
      COMMUNITY_CONTRACTS.kryptonauten,
      0,
      BigNumber.from(
        "0x043dd28dedaf4209e7aa7ed460e2a45e0915b7eb000000000000000000000001"
      ),
      COMMUNITY_WALLETS.kryptonauten,
      MAX_SUPPLY.kryptonauten,
      MIN_BALANCE.kryptonauten,
      PERC_ROYAL.kryptonauten,
      false
    );
    if (debug) {
      console.log("Whitelisted Kryptonauten contract");
    }
  } catch (e) {
    console.error("Cannot whitelist Kryptonauten contract", e);
  }

  // Duck DAO
  try {
    await addWhitelistedContract(
      cryptoCocks,
      owner,
      COMMUNITY_CONTRACTS.duckdao,
      1,
      COMMUNITY_WALLETS.duckdao,
      MAX_SUPPLY.duckdao,
      MIN_BALANCE.duckdao,
      PERC_ROYAL.duckdao,
      false,
      false
    );
    if (debug) {
      console.log("Whitelisted Duck DAO contract");
    }
  } catch (e) {
    console.error("Cannot whitelist Duck Dao contract", e);
  }

  // Lobster DAO
  try {
    await addWhitelistedContract(
      cryptoCocks,
      owner,
      COMMUNITY_CONTRACTS.lobsterdao,
      2,
      COMMUNITY_WALLETS.lobsterdao,
      MAX_SUPPLY.lobsterdao,
      MIN_BALANCE.lobsterdao,
      PERC_ROYAL.lobsterdao,
      false,
      false
    );
    if (debug) {
      console.log("Whitelisted Lobster DAO contract");
    }
  } catch (e) {
    console.error("Cannot whitelist Lobster DAO contract", e);
  }

  // CyberKongz
  try {
    await addWhitelistedContract(
      cryptoCocks,
      owner,
      COMMUNITY_CONTRACTS.cyberkongz,
      3,
      COMMUNITY_WALLETS.cyberkongz,
      MAX_SUPPLY.cyberkongz,
      MIN_BALANCE.cyberkongz,
      PERC_ROYAL.cyberkongz,
      false,
      false
    );
    if (debug) {
      console.log("Whitelisted CyberKongz contract");
    }
  } catch (e) {
    console.error("Cannot whitelist CyberKongz contract", e);
  }

  // DAO Maker
  try {
    await addWhitelistedContract(
      cryptoCocks,
      owner,
      COMMUNITY_CONTRACTS.daomaker,
      4,
      COMMUNITY_WALLETS.daomaker,
      MAX_SUPPLY.daomaker,
      MIN_BALANCE.daomaker,
      PERC_ROYAL.daomaker,
      false,
      false
    );
    if (debug) {
      console.log("Whitelisted DAO Maker contract");
    }
  } catch (e) {
    console.error("Cannot whitelist DAO Maker contract", e);
  }

  // NeoTokyo
  try {
    await addWhitelistedContract(
      cryptoCocks,
      owner,
      COMMUNITY_CONTRACTS.neotokyo,
      5,
      COMMUNITY_WALLETS.neotokyo,
      MAX_SUPPLY.neotokyo,
      MIN_BALANCE.neotokyo,
      PERC_ROYAL.neotokyo,
      false,
      false
    );
    if (debug) {
      console.log("Whitelisted NeoTokyo contract");
    }
  } catch (e) {
    console.error("Cannot whitelist NeoTokyo contract", e);
  }
}
