import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';

describe('Dao Contract', () => {
  let dao: Contract;
  let targets: string[];
  let values: number[];
  let calldatas: string[];
  let description: string;
  let accountAddress: string;
  let votingPeriod: number;
  let token: Contract; // Replace with the actual token contract

  beforeEach(async () => {
    // Deploy the contract before each test
    const DaoFactory: ContractFactory = await ethers.getContractFactory('Dao');
    dao = await DaoFactory.deploy(
      'MyDao',  // Fake name
      ethers.constants.AddressZero, // Fake token address
      10, // Fake voting delay
      100, // Fake voting period
      1000, // Fake proposal threshold
      100, // Fake min tokens for proposal
      50, // Fake min participation
      ethers.constants.AddressZero // Fake timelock address
    );
    await dao.deployed();

    // Fake data for testing
    targets = [ethers.constants.AddressZero];
    values = [0];
    calldatas = ['0x'];
    description = 'Sample Proposal';
    accountAddress = '0x1234567890abcdef1234567890abcdef12345678';
    votingPeriod = 100; // Fake voting period

    // Deploy the token contract and set it as the dao's token
    const TokenFactory: ContractFactory = await ethers.getContractFactory('Token'); // Replace with the actual token contract factory
    token = await TokenFactory.deploy();
    await token.deployed();
    await dao.setToken(token.address);
  });

  it('should create a proposal and allow voting', async () => {
    // Create a proposal
    const proposalId = await dao.propose(targets, values, calldatas, description);

    // Cast a vote
    const support = 1; // 1 for yes, 2 for no
    const weight = 100; // Voting weight
    await dao.castVote(proposalId, support, weight);

    // Assert the vote was casted successfully
    const voteCount = await dao.getVotes(proposalId, accountAddress);
    expect(voteCount).to.equal(weight);
  });

  it('should execute a proposal and transfer tokens', async () => {
    // Create a proposal
    const proposalId = await dao.propose(targets, values, calldatas, description);

    // Cast some votes
    await dao.castVote(proposalId, 1, 100);
    await dao.castVote(proposalId, 2, 50);

    // Wait for the voting period to end
    await ethers.provider.send('evm_increaseTime', [votingPeriod]);
    await ethers.provider.send('evm_mine');

    // Execute the proposal
    await dao.execute(proposalId);

    // Check if tokens were transferred
    const tokenBalance = await token.balanceOf(dao.address);
    expect(tokenBalance).to.equal(0); // All tokens should be transferred out
  });

  it('should cancel a proposal and refund tokens', async () => {
    // Create a proposal
    const proposalId = await dao.propose(targets, values, calldatas, description);

    // Cancel the proposal
    await dao.cancel(proposalId);

    // Check if tokens were refunded
    const tokenBalance = await token.balanceOf(dao.address);
    expect(tokenBalance).to.equal(0); // All tokens should be refunded
  });

  it('should not allow creating a proposal without enough tokens', async () => {
    // Try to create a proposal with insufficient tokens
    await expect(
      dao.propose(targets, values, calldatas, description)
    ).to.be.revertedWith('Not have enough tokens to create proposal');
  });

  it('should allow voting only with sufficient voting power', async () => {
    // Create a proposal
    const proposalId = await dao.propose(targets, values, calldatas, description);

    // Try to cast a vote with insufficient voting power
    await expect(
      dao.castVote(proposalId, 1, 100)
    ).to.be.revertedWith('Not have enough power');
  });

  it('should not allow executing a proposal before the voting period ends', async () => {
    // Create a proposal
    const proposalId = await dao.propose(targets, values, calldatas, description);

    // Try to execute the proposal before the voting period ends
    await expect(
      dao.execute(proposalId)
    ).to.be.revertedWith('Voting period has not ended yet');
  });

  it('should not allow canceling a non-existent proposal', async () => {
    // Try to cancel a non-existent proposal
    await expect(
      dao.cancel(999)
    ).to.be.revertedWith('Governor: invalid proposal id');
  });

  it('should return the correct proposal state', async () => {
    // Create a proposal
    const proposalId = await dao.propose(targets, values, calldatas, description);

    // Get the state of the proposal
    const state = await dao.state(proposalId);

    // Assert the state is correct
    expect(state).to.equal('Pending');
  });

  // Add more test cases to cover other contract functionalities
});
