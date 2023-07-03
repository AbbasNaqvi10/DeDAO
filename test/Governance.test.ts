import { ethers } from 'hardhat';
import { expect } from 'chai';
import { IERC20, Dao } from '../typechain-types';

describe("Dao Testing", () => {
  
})

describe('Dao', () => {
  let dao: Dao;
  let token: IERC20;
  let owner: any;
  let proposer: any;
  let voter: any;

  before(async () => {
    const DAO = await ethers.getContractFactory('Dao');
    dao = await DAO.deploy("TestingDAO", 0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889, 0, 1, 1, 1, 1);
    await dao.deployed();

    // Get accounts from Hardhat
    [owner, proposer, voter] = await ethers.getSigners();
  });

  describe('Propose', () => {
    it('Should create a new proposal', async () => {

      // Propose a new action
      const proposalId = await dao.connect(proposer).propose(
        /* targets */,
        /* values */,
        /* calldatas */,
        'Sample proposal'
      );

      // Assert the proposer and other properties of the proposal snapshot

    });

    it('Should revert if the proposer does not have enough tokens', async () => {
      // Attempt to propose without transferring tokens to the proposer
      await expect(
        dao.connect(proposer).propose(
          /* targets */,
          /* values */,
          /* calldatas */,
          'Sample proposal'
        )
      ).to.be.revertedWith('Not have enough tokens to create proposal');
    });
  });

  describe('CastVote', () => {
    it('Should allow a user to cast a vote', async () => {

      // Cast a vote on the proposal
      await dao.connect(voter).castVote(proposalId, /* support */, /* weight */);


    });

    it('Should revert if the user does not have enough tokens', async () => {
      // Attempt to cast a vote without transferring tokens to the voter
      const proposalId = /* existing proposal ID */;
      await expect(
        dao.connect(voter).castVote(proposalId, /* support */, /* weight */)
      ).to.be.revertedWith('You do not have tokens to vote');
    });

    it('Should revert if the user does not have enough power', async () => {
      // Transfer fewer tokens than the required weight to the voter
      await token.transfer(voter.address, /* amount less than required weight */);

      // Propose a new action
      const proposalId = await dao.connect(proposer).propose(
        /* targets */,
        /* values */,
        /* calldatas */,
        'Sample proposal'
      );

      // Attempt to cast a vote with weight greater than the user's balance
      await expect(
        dao.connect(voter).castVote(proposalId, /* support */, /* weight */)
      ).to.be.revertedWith('Not have enough power');
    });
  });

  describe('Execution', () => {
    it('Should execute a proposal', async () => {
      // Transfer enough tokens to the proposer
      await token.transfer(proposer.address, /* amount greater than minTokensForProposal */);

      // Propose a new action
      const proposalId = await dao.connect(proposer).propose(
        /* targets */,
        /* values */,
        /* calldatas */,
        'Sample proposal'
      );

      // Cast a vote on the proposal
      await dao.connect(voter).castVote(proposalId, /* support */, /* weight */);

      // Fast-forward to the end of the voting period
      await ethers.provider.send('evm_increaseTime', [/* votingPeriod */]);
      await ethers.provider.send('evm_mine');

      // Execute the proposal
      await dao.execute(proposalId);

      // Retrieve the proposal state
      const proposalState = await dao.state(proposalId);

      // Assert the proposal state
      expect(proposalState).to.equal(/* expected proposal state */);
    });

    it('Should revert if the minimum participation threshold is not reached', async () => {
      // Transfer enough tokens to the proposer
      await token.transfer(proposer.address, /* amount greater than minTokensForProposal */);

      // Propose a new action
      const proposalId = await dao.connect(proposer).propose(
        /* targets */,
        /* values */,
        /* calldatas */,
        'Sample proposal'
      );

      // Fast-forward to the end of the voting period
      await ethers.provider.send('evm_increaseTime', [/* votingPeriod */]);
      await ethers.provider.send('evm_mine');

      // Attempt to execute the proposal without reaching the minimum participation
      await expect(dao.execute(proposalId)).to.be.revertedWith('Min participation not reached');
    });

    it('Should revert if the proposal does not succeed', async () => {
      // Transfer enough tokens to the proposer
      await token.transfer(proposer.address, /* amount greater than minTokensForProposal */);

      // Propose a new action
      const proposalId = await dao.connect(proposer).propose(
        /* targets */,
        /* values */,
        /* calldatas */,
        'Sample proposal'
      );

      // Fast-forward to the end of the voting period
      await ethers.provider.send('evm_increaseTime', [/* votingPeriod */]);
      await ethers.provider.send('evm_mine');

      // Attempt to execute the proposal without reaching the minimum participation
      await expect(dao.execute(proposalId)).to.be.revertedWith('Proposal not succeeded');
    });
  });

  // Additional test cases can be added as needed
});
