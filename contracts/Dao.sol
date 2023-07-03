// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./Governance.sol";
import "./GovernanceCountingSimple.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./GovernanceSetting.sol";

contract Dao is Governance, GovernanceSettings, GovernanceCountingSimple {
    IERC20 public DAOToken;
    address public token;

    struct ProposerStake {
        address creator;
        uint256 amountStaked;
        uint256 blockNumberDurationStart;
        uint256 blockNumberDurationEnd;
    }

    mapping(uint256 => ProposerStake) private _proposalSnapshot;
    mapping(uint256 => mapping(address => uint256)) private _votingSnapshot;

    event ProposalCreated(uint256 proposaId, address proposer);
    event VoteCast(
        uint256 proposalId,
        uint256 weight,
        uint8 support,
        address voter
    );
    event Execute(uint256 proposalId);
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
        token = _token;
        DAOToken = IERC20(token);
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
            DAOToken.balanceOf(_msgSender()) >= minTokensForProposal(),
            "Not have enough tokens to create proposal"
        );
        DAOToken.transferFrom(
            _msgSender(),
            address(this),
            minTokensForProposal()
        );
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

        emit ProposalCreated(proposalId, _msgSender());

        return proposalId;
    }

    function castVote(
        uint256 proposalId,
        uint8 support,
        uint256 weight
    ) public virtual returns (uint256) {
        uint256 userBalance = DAOToken.balanceOf(_msgSender());
        require(userBalance >= 0, "You do not have tokens to vote");
        require(userBalance >= weight, "Not have enough power");
        address voter = _msgSender();
        _votingSnapshot[proposalId][_msgSender()] = weight;
        DAOToken.transferFrom(_msgSender(), address(this), weight);

        emit VoteCast(proposalId, weight, support, _msgSender());

        return castVoteWithWeight(proposalId, voter, support, weight);
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override {
        require(state(proposalId) == ProposalState.Succeeded);
        super._execute(proposalId, targets, values, calldatas, descriptionHash);

        emit Execute(proposalId);

        require(state(proposalId) == ProposalState.Executed);
        DAOToken.transferFrom(
            address(this),
            _proposalSnapshot[proposalId].creator,
            _proposalSnapshot[proposalId].amountStaked
        );
    }

    function proposerWithdraw(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Expired || state(proposalId) == ProposalState.Canceled,
            "Proposal isn't expired yet"
        );
        require(_proposalSnapshot[proposalId].creator == _msgSender());
        require(_proposalSnapshot[proposalId].amountStaked > 0,"Not have any stake amount for this proposal");
        uint256 amount = _proposalSnapshot[proposalId].amountStaked;
        DAOToken.transferFrom(address(this), _msgSender(), amount);
        _proposalSnapshot[proposalId].amountStaked = 0;
        emit Withdraw(proposalId, _msgSender(), amount);
    }

    function withdraw(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Executed,
            "Proposal isn't executed yet"
        );
        require(
            _votingSnapshot[proposalId][_msgSender()] > 0,
            "Account not have any stake amount in this proposal"
        );
        uint256 amount = _votingSnapshot[proposalId][_msgSender()];
        DAOToken.transferFrom(address(this), _msgSender(), amount);
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
