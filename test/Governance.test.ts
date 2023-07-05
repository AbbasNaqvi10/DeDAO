import { ethers } from "hardhat";
import { expect, util } from "chai";
import {
  IERC20,
  Dao,
  IERC20__factory,
  Dao__factory,
  ERC20,
} from "../typechain-types";
import { utils, constants, BigNumberish, BigNumber, Contract } from "ethers";

describe("Dao Testing", async () => {
  const [owner, proposer, voter] = await ethers.getSigners();
  let dao: Dao;
  let proposalId: BigNumberish;

  const createDao = async (
    name: string,
    tokenAddress: string,
    votingDelay: BigNumberish,
    votingPeriod: BigNumberish,
    proposalThreshold: BigNumberish,
    minTokensForProposal: bigint,
    minParticipants: BigNumberish
  ) => {
    const DAO = await ethers.getContractFactory("Dao");
    const Token = await ethers.getContractFactory("ERC20");
    const tokenContract = Token.attach(
      "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"
    ) as unknown as ERC20;

    dao = await DAO.deploy(
      name,
      utils.getAddress(tokenAddress),
      votingDelay,
      votingPeriod,
      proposalThreshold,
      minTokensForProposal * (await tokenContract.decimals()),
      minParticipants
    );
    await dao.deployed();

    return { dao, owner, proposer, voter };
  };

  const createProposal = async (
    target: string,
    value: BigNumberish,
    calldatas: string,
    description: string
  ) => {
    proposalId = await dao
      .connect(proposer)
      .propose(target, value, calldatas, description);
    return proposalId;
  };

  const castVote = async (
    proposalId: BigNumberish,
    support: BigNumberish,
    weight: BigNumberish
  ) => {
    const vote = await dao.connect(voter).castVote(proposalId, support, weight);
    return vote;
  };

  const executeProposal = async (proposalId: BigNumberish) => {
    await dao.connect(proposer).execute(proposalId);
  };

  const proposerWithdraw = async (proposalId: BigNumberish) => {
    await dao.connect(proposer).proposerWithdraw(proposalId);
  };

  const voterWithdraw = async (proposalId: BigNumberish) => {
    await dao.connect(voter).withdraw(proposalId);
  };

  before(async () => {
    it("Should deploy Dao", async () => {
      await createDao(
        "testingDao",
        "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
        0,
        1,
        2,
        BigInt(5),
        1
      );
    });
  });

  describe("Proposal", () => {
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

    it("should allow a user to create a proposal", async () => {
      await createProposal(
        "0xD217BDE2332d7f902e913d5567f4b1e56AEa6bd9",
        0,
        iface.encodeFunctionData("mint", [
          "0x283070d8D9ff69fCC9f84afE7013C1C32Fd5A19F",
          ethers.utils.parseEther("100"),
        ]),
        "testing proposal"
      );
    });

    it("Should revert if the proposer does not have enough tokens", async () => {
      // Attempt to propose without transferring tokens to the proposer
      await expect(
        await createProposal(
          "0xD217BDE2332d7f902e913d5567f4b1e56AEa6bd9",
          0,
          iface.encodeFunctionData("mint", [
            "0x283070d8D9ff69fCC9f84afE7013C1C32Fd5A19F",
            ethers.utils.parseEther("100"),
          ]),
          "testing proposal"
        )
      ).to.be.revertedWith("Not have enough tokens to create proposal");
    });
  });

  describe("Vote", () => {
    const voteSupport = 1; // 1 for support, 0 for opposition
    const voteWeight = ethers.utils.parseEther("1");
    it("should allow a user to vote on a proposal", async () => {
      // Vote on the proposal
      await castVote(proposalId, voteSupport, voteWeight);
    });

    it("Should revert if the user does not have enough tokens", async () => {
      await expect(
        await castVote(proposalId, voteSupport, voteWeight)
      ).to.be.revertedWith("You do not have tokens to vote");
    });

    it("Should revert if the user does not have enough power", async () => {
      // Attempt to cast a vote with weight greater than the user's balance
      await expect(
        await castVote(proposalId, voteSupport, ethers.utils.parseEther("10"))
      ).to.be.revertedWith("Not have enough power");
    });
  });

  describe("Execute", () => {
    it("should execute a proposal and transfer tokens", async () => {
      await executeProposal(proposalId);
    });

    it("Should revert if the minimum participation threshold is not reached", async () => {
      // Attempt to execute the proposal without reaching the minimum participation
      await expect(await executeProposal(proposalId)).to.be.revertedWith(
        "Min participation not reached"
      );
    });

    it("Should revert if the proposal does not succeed", async () => {
      // Attempt to execute the proposal without reaching the minimum participation
      await expect(await executeProposal(proposalId)).to.be.revertedWith(
        "Proposal not succeeded"
      );
    });
  });

  describe("Withdraw", () => {
    it("should allow a proposer to withdraw their stake if the proposal is expired or canceled", async () => {
      await proposerWithdraw(proposalId);
    });

    it("should allow a voter to withdraw their tokens after a proposal is executed", async () => {
      await voterWithdraw(proposalId);
    });
  });
});
