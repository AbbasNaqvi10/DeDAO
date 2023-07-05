// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./GovernanceCountingSimple.sol";
import "./GovernanceSetting.sol";
import "./Governance.sol";

contract ChailabsDAO is Governance, GovernanceSettings, GovernanceCountingSimple {
    using SafeERC20 for IERC20;

    event VoteCast(uint256 proposalId, uint96 weight, uint8 support);
    event Withdraw(uint256 proposalId, address receiver, uint96 amount);

    IERC20 public token;

    mapping(uint256 => ProposerStake) private _proposalStakeSnapshot;
    mapping(uint256 => mapping(address => uint96)) private _votingSnapshot;

    struct ProposerStake {
        address creator;
        uint96 amountStaked;
    }

    constructor(
        string memory _name,
        address _token,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _minTokensForProposal,
        uint256 _minParticipation
    )
        Governance(_name)
        GovernanceSettings(
            _votingDelay,
            _votingPeriod,
            _proposalThreshold,
            _minTokensForProposal,
            _minParticipation
        )
    {
        token = IERC20(_token);
    }

    /**
     * @dev See {IGovernor-propose}. This function has opt-in frontrunning protection, described in {_isValidDescriptionForProposer}.
     */
    function propose(
        address target,
        uint256 value,
        bytes memory calldatas,
        string memory description
    ) public virtual override returns (uint256) {
        require(
            token.balanceOf(_msgSender()) >= minTokensForProposal(),
            "DAO: Not enough tokens to create proposal"
        );
        token.safeTransferFrom(
            _msgSender(),
            address(this),
            minTokensForProposal()
        );
        uint256 proposalId = super.propose(
            target,
            value,
            calldatas,
            description
        );
        _proposalStakeSnapshot[proposalId] = ProposerStake({
            creator: _msgSender(),
            amountStaked: uint96(minTokensForProposal())
        });

        return proposalId;
    }

    function castVote(
        uint256 proposalId,
        uint8 support,
        uint96 weight
    ) public virtual returns (uint256) {
        uint96 userBalance = uint96(token.balanceOf(_msgSender()));
        require(userBalance >= weight, "DAO: Not enough voting power");
        token.safeTransferFrom(_msgSender(), address(this), weight);

        emit VoteCast(proposalId, weight, support);

        return castVoteWithWeight(proposalId, _msgSender(), support, weight);
    }

    function _execute(
        uint256 proposalId,
        address target,
        uint256 value,
        bytes memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override {
        require(state(proposalId) == ProposalState.Succeeded, "DAO: Proposal is still active");
        super._execute(proposalId, target, value, calldatas, descriptionHash);

        require(state(proposalId) == ProposalState.Executed, "DAO: Proposal is not executed");
        ProposerStake memory proposer = _proposalStakeSnapshot[proposalId];
        token.safeTransfer(proposer.creator, proposer.amountStaked);
        delete _proposalStakeSnapshot[proposalId];
    }

    function proposerWithdraw(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Expired || state(proposalId) == ProposalState.Canceled,
            "DAO: Proposal is still active"
        );
        ProposerStake memory proposer = _proposalStakeSnapshot[proposalId];
        require(proposer.creator == _msgSender(), "DAO: Not proposal creator");
        require(proposer.amountStaked > 0, "DAO: No stake for this proposal");
        token.safeTransfer(_msgSender(), proposer.amountStaked);
        delete _proposalStakeSnapshot[proposalId];
        emit Withdraw(proposalId, _msgSender(), proposer.amountStaked);
    }

    function withdraw(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Executed ||
            state(proposalId) == ProposalState.Expired ||
            state(proposalId) == ProposalState.Canceled,
            "DAO: Proposal is still active"
        );
        uint96 amount = _votingSnapshot[proposalId][_msgSender()];
        require(amount > 0, "DAO: No stake for this proposal");
        delete _votingSnapshot[proposalId][_msgSender()];
        token.safeTransfer(_msgSender(), amount);
        emit Withdraw(proposalId, _msgSender(), amount);
    }

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public pure override returns (string memory) {
        return "";
    }

    function quorum(uint256 timepoint) public view virtual override returns (uint256) {
        return minParticipation();
    }

    // Inline the functions from GovernanceSettings

    function votingDelay() public view override(IGovernance, GovernanceSettings) returns (uint256) { return super.votingDelay(); }

    function votingPeriod() public view override(IGovernance, GovernanceSettings) returns (uint256) { return super.votingPeriod(); }

    function proposalThreshold() public view override(Governance, GovernanceSettings) returns (uint256){ return super.proposalThreshold(); }
}
