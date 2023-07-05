import { ethers } from "hardhat";
import { expect, util } from "chai";
import { IMyToken, ChailabsDAO, MyToken } from "../typechain-types";
import {
  BigNumberish,
  Interface,
  parseEther,
  Wallet,
  ContractRunner,
} from "ethers";
import dotenv, { parse } from "dotenv";

dotenv.config();

describe("Dao Testing", function () {
  let dao: ChailabsDAO;
  let token: MyToken;
  let proposalId: BigNumberish;
  let ABI = [
    {
      inputs: [
        {
          internalType: "address",
          name: "_to",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "_value",
          type: "uint256",
        },
      ],
      name: "mint",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  let iface = new Interface(ABI);
  const wallet = new Wallet(process.env.PRIVATE_KEY as string);

  const createDao = async (
    name: string,
    votingDelay: BigNumberish,
    votingPeriod: BigNumberish,
    proposalThreshold: BigNumberish,
    minTokensForProposal: bigint,
    minParticipants: BigNumberish
  ) => {
    const [deployer, proposer, voter] = await ethers.getSigners();

    const DAO = await ethers.getContractFactory("ChailabsDAO");
    const Token = await ethers.getContractFactory("MyToken");

    token = await Token.deploy("WMATIC", "WMT", 18);
    await token.waitForDeployment();
    await (await token.mint(deployer.address, 1000)).wait();
    await (await token.mint(proposer.address, 1000)).wait();
    await (await token.mint(voter.address, 1000)).wait();
    const tokenAddress = await token.getAddress();

    dao = await DAO.deploy(
      name,
      tokenAddress,
      votingDelay,
      votingPeriod,
      proposalThreshold,
      minTokensForProposal * BigInt(await token.decimals()),
      minParticipants
    );

    return dao;
  };

  const createProposal = async (
    proposer: ContractRunner,
    target: string,
    value: BigNumberish,
    calldatas: string,
    description: string
  ) => {
    const txResponse = await dao
      .connect(proposer)
      .propose(target, value, calldatas, description);
    const receipt = await txResponse.wait();
    console.log(receipt?.logs);

    return proposalId;
  };

  const castVote = async (
    voter: ContractRunner,
    proposalId: BigNumberish,
    support: BigNumberish,
    weight: BigNumberish
  ) => {
    const vote = await dao.connect(voter).castVote(proposalId, support, weight);
    return vote;
  };

  const executeProposal = async (
    user: ContractRunner,
    proposalId: BigNumberish
  ) => {
    await dao.connect(user).execute(proposalId);
  };

  const proposerWithdraw = async (
    proposer: ContractRunner,
    proposalId: BigNumberish
  ) => {
    await dao.connect(proposer).proposerWithdraw(proposalId);
  };

  const voterWithdraw = async (
    voter: ContractRunner,
    proposalId: BigNumberish
  ) => {
    await dao.connect(voter).withdraw(proposalId);
  };

  before(async () => {
    try {
     
      // Create DAO with desired parameters
      await createDao("testingDao", 0, 1, 2, BigInt(5), 1);
    } catch (error) {
      console.log("error:-----", error);
    }
  });

  describe("Proposal", () => {
    it("should allow a user to create a proposal", async () => {
      const [deployer] = await ethers.getSigners();
      // Create a proposal
      const proposalId = await createProposal(
        deployer,
        "0xD217BDE2332d7f902e913d5567f4b1e56AEa6bd9",
        0,
        iface.encodeFunctionData("mint", [
          "0x283070d8D9ff69fCC9f84afE7013C1C32Fd5A19F",
          parseEther("100"),
        ]),
        "testing proposal"
      );

      // Assert that the proposal ID is not empty
      expect(proposalId).to.not.be.undefined;
    });

    it("Should revert if the proposer does not have enough tokens", async () => {
      const [deployer] = await ethers.getSigners();
      // Attempt to propose without transferring tokens to the proposer
      await expect(
        createProposal(
          deployer,
          "0xD217BDE2332d7f902e913d5567f4b1e56AEa6bd9",
          0,
          iface.encodeFunctionData("mint", [
            "0x283070d8D9ff69fCC9f84afE7013C1C32Fd5A19F",
            parseEther("100"),
          ]),
          "testing proposal"
        )
      ).to.be.revertedWith("Not have enough tokens to create proposal");
    });
  });

  describe("Vote", () => {
    const voteSupport = 1; // 1 for support, 0 for opposition
    const voteWeight = parseEther("500");
    let voteProposalId: BigNumberish;

    before(async () => {
      const [deployer] = await ethers.getSigners();
      // Create a proposal
      voteProposalId = await createProposal(
        deployer,
        "0xD217BDE2332d7f902e913d5567f4b1e56AEa6bd9",
        0,
        iface.encodeFunctionData("mint", [
          "0x283070d8D9ff69fCC9f84afE7013C1C32Fd5A19F",
          parseEther("100"),
        ]),
        "testing vote proposal"
      );
    });

    it("should allow a user to vote on a proposal", async () => {
      const [, , voter] = await ethers.getSigners();
      // Cast a vote on the proposal
      const vote = await castVote(
        voter,
        voteProposalId,
        voteSupport,
        voteWeight
      );

      // Assert that the vote was successful
      expect(vote).to.not.be.undefined;
    });

    it("should allow a user to vote on a old proposal", async () => {
      const [, , voter] = await ethers.getSigners();
      // Cast a vote on the proposal
      const vote = await castVote(voter, proposalId, voteSupport, voteWeight);

      // Assert that the vote was successful
      expect(vote).to.not.be.undefined;
    });

    it("Should revert if the user does not have enough tokens", async () => {
      const [, , voter] = await ethers.getSigners();
      // Attempt to vote without having enough tokens
      await expect(
        castVote(voter, proposalId, voteSupport, voteWeight)
      ).to.be.revertedWith("You do not have tokens to vote");
    });

    it("Should revert if the user does not have enough power", async () => {
      const [, , voter] = await ethers.getSigners();
      // Attempt to cast a vote with weight greater than the user's balance
      await expect(
        castVote(voter, proposalId, voteSupport, parseEther("10000"))
      ).to.be.revertedWith("Not have enough power");
    });
  });

  describe("Execute", () => {
    it("should execute a proposal and transfer tokens", async () => {
      const [deployer] = await ethers.getSigners();
      // Execute the proposal
      await executeProposal(deployer, proposalId);
    });

    it("Should revert if the minimum participation threshold is not reached", async () => {
      const [deployer] = await ethers.getSigners();
      // Attempt to execute the proposal without reaching the minimum participation
      await expect(executeProposal(deployer, proposalId)).to.be.revertedWith(
        "Min participation not reached"
      );
    });

    it("Should revert if the proposal does not succeed", async () => {
      const [deployer] = await ethers.getSigners();
      // Attempt to execute the proposal without reaching the minimum participation
      await expect(executeProposal(deployer, proposalId)).to.be.revertedWith(
        "Proposal not succeeded"
      );
    });
  });

  describe("Withdraw", () => {
    it("should allow a proposer to withdraw their stake if the proposal is expired or canceled", async () => {
      const [deployer] = await ethers.getSigners();
      // Withdraw the stake of the proposer
      await proposerWithdraw(deployer, proposalId);
    });

    it("should allow a voter to withdraw their tokens after a proposal is executed", async () => {
      const [, voter] = await ethers.getSigners();
      // Withdraw the tokens of the voter
      await voterWithdraw(voter, proposalId);
    });
  });
});
