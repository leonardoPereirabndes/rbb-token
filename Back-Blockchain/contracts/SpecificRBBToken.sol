pragma solidity ^0.5.0;

import "./RBBLib.sol";
import "./RBBRegistry.sol";
import "./RBBToken.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/lifecycle/Pausable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract SpecificRBBToken is Ownable, Pausable {

    RBBRegistry public registry;
    RBBToken public rbbToken;

    using SafeMath for uint;

    //It must be private, so it can not be manipulated in specific contract instances that inherit from this one.
    //RBBid => (specificHash of RBBId generated by the specific token) => amount)
    mapping (uint => mapping (bytes32 => uint)) private rbbBalances;

    modifier onlyByRBBToken() {
        require (msg.sender == address(rbbToken), "Somente o RBB_Token pode chamar essa função do token específico");
        _;
    }

    constructor (address newrbbTokenAddr) public {
        rbbToken = RBBToken(newrbbTokenAddr);
    }

    function register(address newRegistryAddr) public onlyByRBBToken {
        registry = RBBRegistry(newRegistryAddr);
    }

//TODO: avaliar se deve incluir um objeto genérico para registrar informacoes (ou deixa apenas nos contratos especificos)
    function transfer (uint fromId, bytes32 fromHash, uint toId, bytes32 toHash, uint amount)
                        whenNotPaused internal {

        //avaliar se queremos restringir isso?????/
        require (amount>0, "Valor a ser transacionado deve ser maior do que zero.");
         
        uint senderId = registry.getId(msg.sender);

        require(senderId==fromId, "A transação precisa ser enviada pelo dono do titular da conta de origem");
        require(registry.isValidatedId(fromId), "Conta de origem precisa estar com cadastro validado");
        require(registry.isValidatedId(toId), "Conta de destino precisa estar com cadastro validado");

        //altera valores de saldo
        rbbBalances[fromId][fromHash] =
                rbbBalances[fromId][fromHash].sub(amount, "Saldo da origem não é suficiente para a transferência");
        rbbBalances[toId][toHash] = rbbBalances[toId][toHash].add(amount);

        rbbToken.registerTransfer(fromId, fromHash, toId, toHash, amount);

    }

    function allocate(uint idOwberRBBToken, uint amount) public onlyByRBBToken {

        bytes32 bcHash = rbbToken.getBusinessContractHash( address(this) );
        rbbBalances[idOwberRBBToken][bcHash] = rbbBalances[idOwberRBBToken][bcHash].add(amount);
    }

    function desallocate (uint fromId, bytes32 fromHash, uint amount) internal {

        rbbBalances[fromId][fromHash] =
                rbbBalances[fromId][fromHash].sub(amount, "Saldo não é suficiente para realizar a operação");

        rbbToken.burnBySpecificContract(amount);

    }

}
