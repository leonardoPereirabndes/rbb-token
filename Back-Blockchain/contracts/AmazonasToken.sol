pragma solidity ^0.5.0;

import "./RBBLib.sol";
import "./RBBRegistry.sol";
import "./RBBToken.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/lifecycle/Pausable.sol";

contract FABndesToken is Ownable, Pausable {

    RBBRegistry public registry;
    RBBToken public rbbToken;

    //É o id, nao tem como especializar dentro do BNDES. Diferença no front-end
    uint public responsibleForSettlement;
    uint public responsibleForDisbursement;

    uint8 public RESERVED_SUPPLIER_ID_FINANCIAL_SUPPORT_AGREEMENT = 0;


    //ATENCAO: troquei cnpj por id no argumento do evento e tirei arg de contrato no resgate - impacto no BNDESTransparente
    event Disbursement  (uint idClient, uint idFinancialSupportAgreement, uint amount);
    event TokenTransfer (uint fromCnpj, uint fromIdFinancialSupportAgreement, uint toCnpj, uint amount);
    event RedemptionRequested (uint idClaimer, uint amount);
    event RedemptionSettlement(string redemptionTransactionHash, string receiptHash);


    constructor (address newRegistryAddr, address newrbbTokenAddr, uint8 _decimals,
                uint responsibleForDisbursementArg, uint responsibleForSettlementArg)
                public {

        registry = RBBRegistry(newRegistryAddr);
        rbbToken = RBBToken(newrbbTokenAddr);
        setResponsibleForDisbursement(responsibleForDisbursementArg);
        setResponsibleForSettlement(responsibleForSettlementArg);
    }

    function makeDisbursement(uint clientId, uint idFinancialSupportAgreement, uint amount)
        public whenNotPaused onlyResponsibleForDisbursement {

        //incluir regras especificas de validacao de cliente e do contrato aqui
        //****** */

        bytes32 hashTo = keccak256(abi.encodePacked(idFinancialSupportAgreement));
        rbbToken.transfer(rbbToken.RESERVED_ID_VALUE(), rbbToken.RESERVED_HASH_VALUE(), clientId, hashTo, amount);

        emit Disbursement (clientId, idFinancialSupportAgreement, amount);

    }

    function paySupplier (uint idFinancialSupportAgreement, uint amount, uint supplierId) whenNotPaused public {
        
        uint clientId = registry.getId(msg.sender);

        //incluir regras especificas de pagamento aqui

        require(clientId != supplierId,
            "Um CNPJ não pode transferir token para si, ainda que em papéis distintos (Cliente/Fornecedor)");
        
        //****** */


        bytes32 hashFrom = keccak256(abi.encodePacked(idFinancialSupportAgreement));
        bytes32 hashTo = keccak256(abi.encodePacked(RESERVED_SUPPLIER_ID_FINANCIAL_SUPPORT_AGREEMENT));
        rbbToken.transfer(clientId, hashFrom, supplierId, hashTo, amount);

        emit TokenTransfer (clientId, idFinancialSupportAgreement, supplierId, amount);
    }

    function redeem(uint amount) whenNotPaused public {
        
        uint supplierId = registry.getId(msg.sender);


        //incluir regras especificas de resgate aqui
        //****** */
        
        bytes32 hashFrom = keccak256(abi.encodePacked(RESERVED_SUPPLIER_ID_FINANCIAL_SUPPORT_AGREEMENT));
        rbbToken.transfer(supplierId, hashFrom, rbbToken.RESERVED_ID_VALUE(), rbbToken.RESERVED_HASH_VALUE(), amount);

        //TODO: chama metodo para pagamento FIAT (mock?)
        //****** */

        emit RedemptionRequested (supplierId, amount);

    }

   /**
    * Using this function, the Responsible for Settlement indicates that he has made the FIAT money transfer.
    * @param redemptionTransactionHash hash of the redeem transaction in which the FIAT money settlement occurred.
    * @param receiptHash hash that proof the FIAT money transfer
    */
    function notifyRedemptionSettlement(string memory redemptionTransactionHash, string memory receiptHash)
        public whenNotPaused onlyResponsibleForSettlement {

        require (RBBLib.isValidHash(receiptHash), "O hash do recibo é inválido");
        emit RedemptionSettlement(redemptionTransactionHash, receiptHash);
    }


//avaliar se deve passar pelo framework de mudanca (exceto construtor)
    function setResponsibleForDisbursement(uint idResponsible) onlyOwner public {
        require (registry.isValidatedId(idResponsible), "Id do Responsible for Disbursement não está validado");
        responsibleForDisbursement = idResponsible;
    }

//avaliar se deve passar pelo framework de mudanca (exceto construtor)
    function setResponsibleForSettlement(uint idResponsible) onlyOwner public {
        require (registry.isValidatedId(idResponsible), "Id do Responsible for Settlement não está validado");
        responsibleForSettlement = idResponsible;
    }

    function isResponsibleForDisbursement(address addr) public view returns (bool) {
        return (registry.getId(addr) == responsibleForDisbursement);
    }

    function isResponsibleForSettlement(address addr) public view returns (bool) {
        return (registry.getId(addr) == responsibleForSettlement);
    }

    modifier onlyResponsibleForDisbursement() {
        require(isResponsibleForDisbursement(msg.sender), "Apenas o responsável pela liberação pode executar essa operação");
        _;
    }

    modifier onlyResponsibleForSettlement() {
        require(isResponsibleForSettlement(msg.sender), "Apenas o responsável pela liquidação pode executar essa operação");
        _;
    }
}