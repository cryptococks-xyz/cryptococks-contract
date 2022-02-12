import { expect } from "chai";
import { ethers } from "hardhat";
import { Contracts, deploy } from "./deploy";
import {
  addWhitelistedContract,
  addWhitelistedContracts,
  assertBalanceOf,
  assertListContract,
  COMMUNITY_TOKEN_HOLDERS,
} from "./helper";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Whitelist", function () {
  let contracts: Contracts;
  let owner: SignerWithAddress,
    nonOwner: SignerWithAddress,
    signer1: SignerWithAddress;

  beforeEach(async () => {
    [owner, signer1] = await ethers.getSigners();
    nonOwner = signer1;
    contracts = await deploy(owner);
  });

  it("should revert when trying to get a contract that does not exist", async () => {
    const tx = contracts.cryptoCocks.getListContract(0);
    await expect(tx).to.be.revertedWith("LC_NOT_FOUND");
  });

  describe("Add Contracts", function () {
    it("should be possible to add a whitelisted contract", async () => {
      const percRoyal = 10;
      const maxSupply = 2;
      const minBalance = 100;
      const communityWallet = signer1;
      const testToken = contracts.testTokenOne;
      const id = 0;

      await addWhitelistedContract(
        contracts.cryptoCocks,
        owner,
        testToken.address,
        id,
        communityWallet.address,
        maxSupply,
        minBalance,
        percRoyal
      );

      const tx = contracts.cryptoCocks.getListContract(0);
      await expect(tx).to.not.be.reverted;
    });

    it("should be possible to add a whitelisted contract by owner only", async () => {
      const percRoyal = 10;
      const maxSupply = 2;
      const minBalance = 100;
      const communityWallet = signer1;
      const testToken = contracts.testTokenOne;
      const cc = testToken.address;
      const wallet = communityWallet.address;

      await expect(
        contracts.cryptoCocks
          .connect(nonOwner)
          .addWhiteListing(
            0,
            false,
            cc,
            wallet,
            maxSupply,
            minBalance,
            percRoyal,
            0
          )
      ).to.be.reverted;
    });

    it("should be able to add whitelisted contracts with royalty percentages up to 20% in sum", async () => {
      const percRoyals = [8, 6, 3, 2, 1];
      const communityWallet = signer1;
      const testToken = contracts.testTokenOne;

      let index = 0;
      for (const percRoyal of percRoyals) {
        await addWhitelistedContract(
          contracts.cryptoCocks,
          owner,
          testToken.address,
          index,
          communityWallet.address,
          2,
          100,
          percRoyal
        );
        index++;
      }
    });

    it("should not be able to add whitelisted contracts with royalty percentages more than 20% in sum", async () => {
      const percRoyals = [8, 6, 4, 1, 2]; // 21% (last transaction should fail)
      const communityWallet = signer1;
      const testToken = contracts.testTokenOne;

      for (const percRoyal of percRoyals) {
        // last transaction should fail
        const index = percRoyals.indexOf(percRoyal);
        let expectRevert = false;
        if (index === percRoyals.length - 1) {
          expectRevert = true;
        }

        await addWhitelistedContract(
          contracts.cryptoCocks,
          owner,
          testToken.address,
          index,
          communityWallet.address,
          2,
          100,
          percRoyal,
          expectRevert
        );
      }
    });

    it("should reset percRoyal when removing contract", async () => {
      const percRoyals = [8, 6, 4, 2, 1]; // 21% (last transaction should fail)
      const communityWallet = signer1;
      const testToken = contracts.testTokenOne;

      for (const percRoyal of percRoyals) {
        // last transaction should fail
        const index = percRoyals.indexOf(percRoyal);
        let expectRevert = false;
        if (index === percRoyals.length - 1) {
          expectRevert = true;
        }

        await addWhitelistedContract(
          contracts.cryptoCocks,
          owner,
          testToken.address,
          index,
          communityWallet.address,
          2,
          100,
          percRoyal,
          expectRevert
        );
      }

      // remove contract
      await assertListContract(contracts.cryptoCocks, 0);
      const tx1 = contracts.cryptoCocks.connect(owner).removeWhitelisting(0);
      await expect(tx1).to.not.be.reverted;
      await assertListContract(contracts.cryptoCocks, 0, false);

      await addWhitelistedContract(
        contracts.cryptoCocks,
        owner,
        testToken.address,
        0,
        communityWallet.address,
        2,
        100,
        percRoyals[0] + 1,
        true
      );

      await addWhitelistedContract(
        contracts.cryptoCocks,
        owner,
        testToken.address,
        0,
        communityWallet.address,
        2,
        100,
        percRoyals[0],
        false
      );
    });
  });

  describe("Remove Contracts", function () {
    const listContractId1 = 0;
    const listContractId2 = 1;

    beforeEach(async () => {
      const communityWallet = signer1;
      const testToken = contracts.testTokenOne;

      await addWhitelistedContract(
        contracts.cryptoCocks,
        owner,
        testToken.address,
        listContractId1,
        communityWallet.address,
        2,
        100,
        10
      );

      await addWhitelistedContract(
        contracts.cryptoCocks,
        owner,
        testToken.address,
        listContractId2,
        communityWallet.address,
        2,
        100,
        10
      );
    });

    it("should be possible to remove a contract", async () => {
      await assertListContract(contracts.cryptoCocks, listContractId1);
      const tx1 = contracts.cryptoCocks
        .connect(owner)
        .removeWhitelisting(listContractId1);
      await expect(tx1).to.not.be.reverted;
      await assertListContract(contracts.cryptoCocks, listContractId1, false);

      await assertListContract(contracts.cryptoCocks, listContractId2);
      const tx2 = contracts.cryptoCocks
        .connect(owner)
        .removeWhitelisting(listContractId2);
      await expect(tx2).to.not.be.reverted;
      await assertListContract(contracts.cryptoCocks, listContractId2, false);
    });

    it("should be possible to remove a contract by owner only", async () => {
      await assertListContract(contracts.cryptoCocks, listContractId1);
      const tx = contracts.cryptoCocks
        .connect(nonOwner)
        .removeWhitelisting(listContractId1);
      await expect(tx).to.be.reverted;
      await assertListContract(contracts.cryptoCocks, listContractId1);
    });
  });

  describe("Query Balance", function () {
    beforeEach(async () => {
      await addWhitelistedContracts(contracts.cryptoCocks);
    });

    it("should be possible to receive balance of CCKN tokens", async () => {
      await assertBalanceOf(
        contracts.cryptoCocks,
        0,
        COMMUNITY_TOKEN_HOLDERS.kryptonauten
      );
    });

    it("should be possible to receive balance of DDIM tokens", async () => {
      await assertBalanceOf(
        contracts.cryptoCocks,
        1,
        COMMUNITY_TOKEN_HOLDERS.duckdao
      );
    });

    it("should be possible to receive balance of LOBS tokens", async () => {
      await assertBalanceOf(
        contracts.cryptoCocks,
        2,
        COMMUNITY_TOKEN_HOLDERS.lobsterdao
      );
    });

    it("should be possible to receive balance of KONGZ tokens", async () => {
      await assertBalanceOf(
        contracts.cryptoCocks,
        3,
        COMMUNITY_TOKEN_HOLDERS.cyberkongz
      );
    });

    it("should be possible to receive balance of DAO tokens", async () => {
      await assertBalanceOf(
        contracts.cryptoCocks,
        4,
        COMMUNITY_TOKEN_HOLDERS.daomaker
      );
    });

    it("should be possible to receive balance of NTCTZN tokens", async () => {
      await assertBalanceOf(
        contracts.cryptoCocks,
        5,
        COMMUNITY_TOKEN_HOLDERS.neotokyo
      );
    });
  });
});
