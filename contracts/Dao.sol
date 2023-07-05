// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./GovernanceCountingSimple.sol";
import "./GovernanceSetting.sol";
import "./Governance.sol";

contract ChailabsDAO is Governance, GovernanceSettings, GovernanceCountingSimple {
    IERC20 public token;

    struct ProposerStake {
        address creator;
        uint256 amountStaked;
    }

    mapping(uint256 => ProposerStake) private _proposalStakeSnapshot;
    mapping(uint256 => mapping(address => uint256)) private _votingSnapshot;

    event VoteCast(
        uint256 proposalId,
        uint256 weight,
        uint8 support,
        address voter
    );
    event Withdraw(uint256 proposalId, address _to, uint256 amount);

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
        token = ERC20(_token);
    }

    // The following functions are overrides required by Solidity.

    function votingDelay()
        public
        view
        override(IGovernance, GovernanceSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernance, GovernanceSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function proposalThreshold()
        public
        view
        override(Governance, GovernanceSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
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
            "DAO: Not have enough tokens to create proposal"
        );
        token.transferFrom(
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
            amountStaked: minTokensForProposal()
        });

        return proposalId;
    }

    function castVote(
        uint256 proposalId,
        uint8 support,
        uint256 weight
    ) public virtual returns (uint256) {
        uint256 userBalance = token.balanceOf(_msgSender());
        require(userBalance >= 0, "DAO: You do not have tokens to vote");
        require(userBalance >= weight, "DAO: Not have enough power");
        address voter = _msgSender();
        _votingSnapshot[proposalId][_msgSender()] = weight;
        token.transferFrom(_msgSender(), address(this), weight);

        emit VoteCast(proposalId, weight, support, _msgSender());

        return castVoteWithWeight(proposalId, voter, support, weight);
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
        token.transferFrom(
            address(this),
            _proposalStakeSnapshot[proposalId].creator,
            _proposalStakeSnapshot[proposalId].amountStaked
        );
    }

    function proposerWithdraw(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Expired || state(proposalId) == ProposalState.Canceled,
            "DAO: Proposal is still active"
        );
        require(_proposalStakeSnapshot[proposalId].creator == _msgSender(), "DAO: Account is not proposal creator");
        require(_proposalStakeSnapshot[proposalId].amountStaked > 0,"DAO: Not have any stake amount for this proposal");
        uint256 amount = _proposalStakeSnapshot[proposalId].amountStaked;
        token.transferFrom(address(this), _msgSender(), amount);
        _proposalStakeSnapshot[proposalId].amountStaked = 0;
        emit Withdraw(proposalId, _msgSender(), amount);
    }

    function withdraw(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Executed || state(proposalId) == ProposalState.Expired || state(proposalId) == ProposalState.Canceled,
            "DAO: Proposal is still active"
        );
        require(
            _votingSnapshot[proposalId][_msgSender()] > 0,
            "DAO: Account not have any stake amount in this proposal"
        );
        uint256 amount = _votingSnapshot[proposalId][_msgSender()];
        token.transferFrom(address(this), _msgSender(), amount);
        _votingSnapshot[proposalId][_msgSender()] = 0;
        emit Withdraw(proposalId, _msgSender(), amount);
    }

    function clock() public view override returns (uint48) {
        return SafeCast.toUint48(block.timestamp);
    }

    function CLOCK_MODE() public view override returns (string memory) {}

    function quorum(
        uint256 timepoint
    ) public view virtual override returns (uint256) {
        return minParticipation();
    }
}
