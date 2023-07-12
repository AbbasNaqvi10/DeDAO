import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { DAO, MyToken } from "../typechain-types";
import { BigNumberish, Signer } from "ethers";

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
  let iface = new ethers.utils.Interface(ABI);
  const MaxUint256 = ethers.constants.MaxInt256;

  const createDao = async (
    name: string,
    votingPeriod: BigNumberish,
    proposalThreshold: BigNumberish,
    minTokensForProposal: bigint,
    minParticipants: BigNumberish
  ) => {
    const [deployer, proposer1, proposer2, voter1, voter2] = await ethers.getSigners();

    const DAO = await ethers.getContractFactory("DAO");
    const Token = await ethers.getContractFactory("MyToken");

    const token = await Token.deploy("WMATIC", "WMT", 18);
    await token.deployed();
    await (await token.mint(deployer.address, 10000)).wait();
    await (await token.mint(proposer1.address, 10000)).wait();
    await (await token.mint(proposer2.address, 1000)).wait();
    await (await token.mint(voter1.address, 10000)).wait();
    await (await token.mint(voter2.address, 1000)).wait();
    const tokenAddress = await token.address;

    const dao = await DAO.deploy(
      name,
      tokenAddress,
      votingPeriod,
      proposalThreshold,
      minTokensForProposal * BigInt(await token.decimals()),
      minParticipants
    );

    return { dao, token, deployer, proposer1, proposer2, voter1, voter2 };
  };

  const createProposal = async (
    dao: DAO,
    token: MyToken,
    proposer: Signer,
    target: string,
    value: BigNumberish,
    calldatas: string,
    description: string
  ) => {
    const proposalStartTime = BigInt((await time.latest()) + 60);

    await (await token.connect(proposer).approve(await dao.address, MaxUint256)).wait();
    const txResponse = await dao.connect(proposer).propose(proposalStartTime, target, value, calldatas, description);
    const receipt = await txResponse.wait();
    receipt?.events?.forEach((event, i) => {
      if (event.args) {
        proposals.push(event.args.proposalId);
      }
    });
    return proposals[proposals.length - 1];
  };

  const castVote = async (
    dao: DAO,
    token: MyToken,
    voter: Signer,
    proposalId: BigNumberish,
    support: BigNumberish,
    weight: BigNumberish
  ) => {
    await (await token.connect(voter).approve(await dao.address, MaxUint256)).wait();
    const txResponse = await dao.connect(voter).castVote(proposalId, support, weight);

    const receipt = await txResponse.wait();
    let vote: any;

    receipt?.events?.forEach((event, i) => {
      if (event.args) {
        vote = event.args.weight;
      }
    });

    return vote;
  };

  const executeProposal = async (dao: DAO, token: MyToken, user: Signer, proposalId: BigNumberish) => {
    // await token.connect(user).approve(await dao, MaxUint256);
    await dao.connect(user).execute(proposalId);
  };

  const proposerWithdraw = async (dao: DAO, token: MyToken, proposer: Signer, proposalId: BigNumberish) => {
    await dao.connect(proposer).proposerWithdraw(proposalId);
  };

  const voterWithdraw = async (dao: DAO, token: MyToken, voter: Signer, proposalId: BigNumberish) => {
    await dao.connect(voter).withdraw(proposalId);
  };

  async function createDaoFixture() {
    // Create DAO with desired parameters
    return await createDao("testingDao", 7200 * 2 * 12, 50, BigInt(500), 1);
  }
  async function createProposalFixture() {
    const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await createDao(
      "testingDao",
      7200 * 2 * 12,
      30,
      BigInt(500),
      2
    );

    // Create a proposal
    const id = await createProposal(
      dao,
      token,
      proposer1,
      await token.address, // target
      0,
      iface.encodeFunctionData("mint", ["0x283070d8D9ff69fCC9f84afE7013C1C32Fd5A19F", ethers.utils.parseEther("100")]),
      "testing proposal"
    );

    return { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 };
  }

  describe("Proposal", () => {
    it("should allow a user to create a proposal", async () => {
      const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(createDaoFixture);

      // Create a proposal
      const id = await createProposal(
        dao,
        token,
        proposer1,
        await token.address, // target
        0,
        iface.encodeFunctionData("mint", [
          "0xaf10e7dbfeb871420d3c1dad91b336335959f0c7",
          ethers.utils.parseEther("100"),
        ]),
        "testing proposal"
      );

      // Assert that the proposal ID is not empty
      expect(id).to.not.be.undefined;
    });

    it("Should revert if the proposer does not have enough tokens", async () => {
      const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(createDaoFixture);

      // Attempt to propose without transferring tokens to the proposer
      await expect(
        createProposal(
          dao,
          token,
          proposer2,
          await token.address,
          0,
          iface.encodeFunctionData("mint", [
            "0xaf10e7dbfeb871420d3c1dad91b336335959f0c7",
            ethers.utils.parseEther("100"),
          ]),
          "testing proposal"
        )
      ).to.be.revertedWith("DAO: Not enough tokens to create proposal");
    });

    it("Should revert if the proposal already exists", async () => {
      const { dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(createDaoFixture);

      // Attempt to propose without transferring tokens to the proposer
      await createProposal(
        dao,
        token,
        deployer,
        await token.address,
        0,
        iface.encodeFunctionData("mint", [
          "0xaf10e7dbfeb871420d3c1dad91b336335959f0c7",
          ethers.utils.parseEther("100"),
        ]),
        "testing proposal"
      );
      await expect(
        createProposal(
          dao,
          token,
          proposer1,
          await token.address,
          0,
          iface.encodeFunctionData("mint", [
            "0xaf10e7dbfeb871420d3c1dad91b336335959f0c7",
            ethers.utils.parseEther("100"),
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
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(
        createProposalFixture
      );

      await time.increase( 60);
      console.log("proposal start time: ", await dao.proposalSnapshot(id));
      console.log("latest time: ", await time.latest());
      console.log("proposal end time: ", await dao.proposalDeadline(id));

      // Cast a vote on the proposal
      const vote = await castVote(dao, token, voter1, id, voteSupport, voteWeight * BigInt(await token.decimals()));

      // Assert that the vote was successful
      expect(vote).to.not.be.undefined;
    });

    it("Should revert if the user does not have enough tokens", async () => {
      const [, , , , , voter3] = await ethers.getSigners();

      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(
        createProposalFixture
      );

      await time.increase( 60);

      // Attempt to vote without having enough tokens
      await expect(castVote(dao, token, voter3, id, voteSupport, voteWeight)).to.be.reverted;
    });

    it("Should revert if the user does not have enough power", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(
        createProposalFixture
      );

      await time.increase( 60);

      // Attempt to cast a vote with weight greater than the user's balance
      await expect(castVote(dao, token, voter2, id, voteSupport, ethers.utils.parseEther("100000"))).to.be.revertedWith(
        "DAO: Not enough voting power"
      );
    });
  });

  describe("Execute", () => {

    it("should execute a proposal and transfer tokens", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(
        createProposalFixture
      );

      await time.increase(60);

      const vote1 = await castVote(dao, token, voter1, id, 1, BigInt(50) * BigInt(await token.decimals()));
      const vote2 = await castVote(dao, token, voter2, id, 1, BigInt(50) * BigInt(await token.decimals()));

      const endTime = await dao.votingPeriod();
      await time.increase(endTime);

      await executeProposal(dao, token, deployer, id);
    });

    it("Should revert if the minimum participation is not reached", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(
        createProposalFixture
      );

      await time.increase( 60);

      const vote = await castVote(dao, token, voter1, id, 1, BigInt(50) * BigInt(await token.decimals()));

      // Attempt to execute the proposal without reaching the minimum participation
      await expect(executeProposal(dao, token, deployer, id)).to.be.revertedWith(
        "Governance: proposal not succeeded"
      );
    });

    it("Should revert if the proposal does not succeed", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(
        createProposalFixture
      );

      await time.increase( 60);

      // Attempt to execute the proposal without reaching the minimum participation
      await expect(executeProposal(dao, token, deployer, id)).to.be.revertedWith(
        "Governance: proposal not succeeded"
      );
    });
  });

  describe("Withdraw", () => {

    it("should allow a proposer to withdraw their stake if the proposal is expired or canceled", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(
        createProposalFixture
      );

      await time.increase(await time.latest());

      // Withdraw the stake of the proposer
      await proposerWithdraw(dao, token, proposer1, id);
    });

    it("should allow a voter to withdraw their tokens after a proposal is executed", async () => {
      const { id, dao, token, deployer, proposer1, proposer2, voter1, voter2 } = await loadFixture(
        createProposalFixture
      );

      await time.increase( 60);

      const vote1 = await castVote(dao, token, voter1, id, 1, BigInt(50) * BigInt(await token.decimals()));
      const vote2 = await castVote(dao, token, voter2, id, 1, BigInt(50) * BigInt(await token.decimals()));

      await time.increase(await dao.proposalDeadline(id));

      // Execute the proposal
      await executeProposal(dao, token, deployer, id);

      await voterWithdraw(dao, token, voter1, id);
    });
  });
});
