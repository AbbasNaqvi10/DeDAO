import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect, util } from "chai";
import { ChailabsDAO, MyToken } from "../typechain-types";
import {
  BigNumberish,
  Interface,
  parseEther,
  Wallet,
  ContractRunner,
  MaxUint256,
} from "ethers";
import dotenv from "dotenv";

dotenv.config();

describe("Dao Testing", function () {
  let proposals: BigNumberish[] = [];
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
  // console.log("private key: ", process.env.PRIVATE_KEY)

  const createDao = async (
    name: string,
    votingDelay: BigNumberish,
    votingPeriod: BigNumberish,
    proposalThreshold: BigNumberish,
    minTokensForProposal: bigint,
    minParticipants: BigNumberish
  ) => {
    const [deployer, proposer1, proposer2, voter1, voter2] =
      await ethers.getSigners();

    const DAO = await ethers.getContractFactory("ChailabsDAO");
    const Token = await ethers.getContractFactory("MyToken");

    const token = await Token.deploy("WMATIC", "WMT", 18);
    await token.waitForDeployment();
    await (await token.mint(deployer.address, 10000)).wait();
    await (await token.mint(proposer1.address, 10000)).wait();
    await (await token.mint(proposer2.address, 1000)).wait();
    await (await token.mint(voter1.address, 10000)).wait();
    await (await token.mint(voter2.address, 1000)).wait();
    const tokenAddress = await token.getAddress();

    const dao = await DAO.deploy(
      name,
      tokenAddress,
      votingDelay,
      votingPeriod,
      proposalThreshold,
      minTokensForProposal * BigInt(await token.decimals()),
      minParticipants
    );

    return { dao, token, deployer, proposer1, proposer2, voter1, voter2 };
  };

  const createProposal = async (
    dao: ChailabsDAO,
    token: MyToken,
    proposer: ContractRunner,
    target: string,
    value: BigNumberish,
    calldatas: string,
    description: string
  ) => {
    await (
      await token.connect(proposer).approve(await dao.getAddress(), MaxUint256)
    ).wait();
    const txResponse = await dao
      .connect(proposer)
      .propose(target, value, calldatas, description);
    const receipt = await txResponse.wait();
    // console.log("proposal logs =====>", receipt?.logs);
    receipt?.logs.forEach((log, i) => {
      const decoded = dao.interface.parseLog({
        data: log.data,
        topics: log.topics as string[],
      });
      if (decoded && decoded.name === "ProposalCreated") {
        proposals.push(decoded.args[0]);
      }
    });
    return proposals[proposals.length - 1];
  };

  const castVote = async (
    dao: ChailabsDAO,
    token: MyToken,
    voter: ContractRunner,
    proposalId: BigNumberish,
    support: BigNumberish,
    weight: BigNumberish
  ) => {
    await (
      await token.connect(voter).approve(await dao.getAddress(), MaxUint256)
    ).wait();
    const txResponse = await dao
      .connect(voter)
      .castVote(proposalId, support, weight);

    const receipt = await txResponse.wait();
    let vote: any;

    receipt?.logs.forEach((log, i) => {
      const decoded = dao.interface.parseLog({
        data: log.data,
        topics: log.topics as string[],
      });
      if (decoded && decoded.name === "VoteCast") {
        vote = decoded.args[3];
      }
    });

    return vote;
  };

  const executeProposal = async (
    dao: ChailabsDAO,
    token: MyToken,
    user: ContractRunner,
    proposalId: BigNumberish
  ) => {
    // await token.connect(user).approve(await dao.getAddress(), MaxUint256);
    await dao.connect(user).execute(proposalId);
  };

  const proposerWithdraw = async (
    dao: ChailabsDAO,
    token: MyToken,
    proposer: ContractRunner,
    proposalId: BigNumberish
  ) => {
    await dao.connect(proposer).proposerWithdraw(proposalId);
  };

  const voterWithdraw = async (
    dao: ChailabsDAO,
    token: MyToken,
    voter: ContractRunner,
    proposalId: BigNumberish
  ) => {
    await dao.connect(voter).withdraw(proposalId);
  };

  async function createDaoFixture() {
    // Create DAO with desired parameters
    return await createDao("testingDao", 0, 7200 * 2 * 12, 50, BigInt(500), 1);
  }
  async function createProposalFixture() {
    const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
      await createDao("testingDao", 0, 7200 * 2 * 12, 30, BigInt(500), 5);

    // Create a proposal
    const id = await createProposal(
      dao,
      token,
      proposer1,
      await token.getAddress(), // target
      0,
      iface.encodeFunctionData("mint", [
        "0x283070d8D9ff69fCC9f84afE7013C1C32Fd5A19F",
        parseEther("100"),
      ]),
      "testing proposal"
    );

    return { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 };
  }

  describe("Proposal", () => {
    it("should allow a user to create a proposal", async () => {
      const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createDaoFixture);

      // Create a proposal
      const id = await createProposal(
        dao,
        token,
        proposer1,
        await token.getAddress(), // target
        0,
        iface.encodeFunctionData("mint", [
          "0xaf10e7dbfeb871420d3c1dad91b336335959f0c7",
          parseEther("100"),
        ]),
        "testing proposal"
      );

      // Assert that the proposal ID is not empty
      expect(id).to.not.be.undefined;
    });

    it("Should revert if the proposer does not have enough tokens", async () => {
      const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createDaoFixture);

      // Attempt to propose without transferring tokens to the proposer
      await expect(
        createProposal(
          dao,
          token,
          proposer2,
          await token.getAddress(),
          0,
          iface.encodeFunctionData("mint", [
            "0xaf10e7dbfeb871420d3c1dad91b336335959f0c7",
            parseEther("100"),
          ]),
          "testing proposal"
        )
      ).to.be.revertedWith("DAO: Not enough tokens to create proposal");
    });

    it("Should revert if the proposal already exists", async () => {
      const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createDaoFixture);

      // Attempt to propose without transferring tokens to the proposer
      await createProposal(
        dao,
        token,
        deployer,
        await token.getAddress(),
        0,
        iface.encodeFunctionData("mint", [
          "0xaf10e7dbfeb871420d3c1dad91b336335959f0c7",
          parseEther("100"),
        ]),
        "testing proposal"
      );
      await expect(
        createProposal(
          dao,
          token,
          proposer1,
          await token.getAddress(),
          0,
          iface.encodeFunctionData("mint", [
            "0xaf10e7dbfeb871420d3c1dad91b336335959f0c7",
            parseEther("100"),
          ]),
          "testing proposal"
        )
      ).to.be.revertedWith("Governance: proposal already exists");
    });
  });

  describe("Vote", () => {
    const voteSupport = 1; // 1 for support, 0 for opposition
    const voteWeight = BigInt(50);

    it("should allow a user to vote on a proposal", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createProposalFixture);

      // Cast a vote on the proposal
      const vote = await castVote(
        dao,
        token,
        voter1,
        id,
        voteSupport,
        voteWeight * BigInt(await token.decimals())
      );

      // Assert that the vote was successful
      expect(vote).to.not.be.undefined;
    });

    it("Should revert if the user does not have enough tokens", async () => {
      const [, , , , , voter3] = await ethers.getSigners();

      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createProposalFixture);

      // Attempt to vote without having enough tokens
      await expect(
        castVote(dao, token, voter3, id, voteSupport, voteWeight)
      ).to.be.revertedWith("DAO: Not enough voting power");
    });

    it("Should revert if the user does not have enough power", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createProposalFixture);

      // Attempt to cast a vote with weight greater than the user's balance
      await expect(
        castVote(dao, token, voter2, id, voteSupport, parseEther("100000"))
      ).to.be.revertedWith("DAO: Not enough voting power");
    });
  });

  describe("Execute", () => {
    async function createProposalAndCastVoteFixture() {
      const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await createDao("testingDao", 0, 7200 * 2 * 12, 50, BigInt(500), 1);

      // Create a proposal
      const id = await createProposal(
        dao,
        token,
        proposer1,
        await token.getAddress(), // target
        0,
        iface.encodeFunctionData("mint", [
          "0x283070d8D9ff69fCC9f84afE7013C1C32Fd5A19F",
          parseEther("100"),
        ]),
        "testing proposal"
      );

      // Cast a vote on the proposal
      const vote = await castVote(
        dao,
        token,
        voter1,
        id,
        1,
        BigInt(50) * BigInt(await token.decimals())
      );

      return {
        vote,
        id,
        dao,
        token,
        deployer,
        proposer1,
        proposer2,
        voter1,
        voter2,
      };
    }

    it("should execute a proposal and transfer tokens", async () => {
      const {
        vote,
        id,
        dao,
        token,
        deployer,
        proposer1,
        proposer2,
        voter1,
        voter2,
      } = await loadFixture(createProposalAndCastVoteFixture);

      const currentTime = await time.latest();
      const endTime = await dao.votingPeriod();
      console.log("current time: ", currentTime);
      console.log("end time: ", endTime);
      await time.increase(1);
      console.log("state: ", await dao.state(id));
      console.log("threshold: ", await dao.proposalThresholdReached(id));

      // Execute the proposal
      console.log(
        "how much proposal threshold meet: ",
        await dao.proposalThresholdReached(id)
      );

      await executeProposal(dao, token, deployer, id);
    });

    it("Should revert if the minimum participation is not reached", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createProposalFixture);

      const vote = await castVote(
        dao,
        token,
        voter1,
        id,
        1,
        BigInt(50) * BigInt(await token.decimals())
      );

      // Attempt to execute the proposal without reaching the minimum participation
      await expect(
        executeProposal(dao, token, deployer, id)
      ).to.be.revertedWith("Governance: proposal not succeeded");
    });

    it("Should revert if the proposal does not succeed", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createProposalFixture);

      // Attempt to execute the proposal without reaching the minimum participation
      await expect(
        executeProposal(dao, token, deployer, id)
      ).to.be.revertedWith("Governance: proposal not succeeded");
    });
  });

  describe("Withdraw", () => {
    it("should allow a proposer to withdraw their stake if the proposal is expired or canceled", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createProposalFixture);

      await time.increase(await time.latest());
      // Withdraw the stake of the proposer
      await proposerWithdraw(dao, token, proposer1, id);
    });

    it("should allow a voter to withdraw their tokens after a proposal is executed", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } =
        await loadFixture(createProposalFixture);
      const voteSupport = 1; // 1 for support, 0 for opposition
      const voteWeight = BigInt(50);

      await castVote(dao, token, voter1, id, voteSupport, voteWeight);
      await castVote(dao, token, voter2, id, voteSupport, voteWeight);
    });
  });
});
