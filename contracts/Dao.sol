// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Governance.sol";
import "./GovernanceCountingSimple.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./GovernanceSetting.sol";

contract Dao is Governance, GovernanceSettings, GovernanceCountingSimple {
    IERC20 public token;

    struct ProposerStake {
        address creator;
        uint256 amountStaked;
        uint256 blockNumberDurationStart;
        uint256 blockNumberDurationEnd;
    }

    mapping(uint256 => ProposerStake) private _proposalSnapshot;
    mapping(uint256 => mapping(address => uint256)) private _votingSnapshot;

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
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public virtual override returns (uint256) {
        require(
            token.balanceOf(_msgSender()) >= minTokensForProposal(),
            "Not have enough tokens to create proposal"
        );
        token.transferFrom(_msgSender(), address(this), minTokensForProposal());
        uint256 proposalId = super.propose(
            targets,
            values,
            calldatas,
            description
        );
        _proposalSnapshot[proposalId] = ProposerStake({
            creator: _msgSender(),
            amountStaked: minTokensForProposal(),
            blockNumberDurationStart: proposalSnapshot(proposalId),
            blockNumberDurationEnd: proposalSnapshot(proposalId) +
                votingPeriod()
        });

        return proposalId;
    }

    function castVote(
        uint256 proposalId,
        uint8 support,
        uint256 weight
    ) public virtual returns (uint256) {
        uint256 userBalance = token.balanceOf(_msgSender());
        require(userBalance >= 0, "You do not have tokens to vote");
        require(userBalance >= weight, "Not have enough power");
        address voter = _msgSender();
        _votingSnapshot[proposalId][_msgSender()] = userBalance;
        token.transferFrom(_msgSender(), address(this), weight);

        return castVoteWithWeight(proposalId, voter, support, weight);
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override {
        require(_quorumReached(proposalId), "Min participation not reached");
        require(_voteSucceeded(proposalId), "Proposal not succeeded");
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
        require(state(proposalId) == ProposalState.Executed);
        token.transferFrom(
            address(this),
            _proposalSnapshot[proposalId].creator,
            _proposalSnapshot[proposalId].amountStaked
        );
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
