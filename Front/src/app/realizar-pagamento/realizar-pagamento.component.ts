import { Component, OnInit, NgZone } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';

import { Transferencia, Subcredito } from './Transferencia';

import { Web3Service } from './../Web3Service';
import { PessoaJuridicaService } from '../pessoa-juridica.service';

import { BnAlertsService } from 'bndes-ux4';
import { Utils } from '../shared/utils';

import {PessoaJuridicaHandle} from '../PessoaJuridicaHandle/PessoaJuridicaHandle';


@Component({
  selector: 'app-realizar-pagamento',
  templateUrl: './realizar-pagamento.component.html',
  styleUrls: ['./realizar-pagamento.component.css']
})
export class RealizarPagamentoComponent implements OnInit {

  transferencia: Transferencia;
  selectedAccount: any;
  maskCnpj: any;
  cnpjOrigem : string;

  constructor(private pessoaJuridicaService: PessoaJuridicaService, protected bnAlertsService: BnAlertsService, private web3Service: Web3Service,
    private ref: ChangeDetectorRef, private zone: NgZone, private router: Router, private pessoaJuridicaHandle: PessoaJuridicaHandle) {

      let self = this;
      setInterval(function () {
        self.recuperaContaSelecionada(), 1000});

  }

  ngOnInit() {
    this.maskCnpj = Utils.getMaskCnpj();      
    this.transferencia = new Transferencia();
    this.inicializaDadosOrigem();
    this.inicializaDadosDestino();

  }


  inicializaDadosOrigem() {
    this.transferencia.subcreditos = new Array<Subcredito>();    
    this.transferencia.numeroSubcreditoSelecionado = null;
    this.transferencia.saldoOrigem = undefined;    
  }


  inicializaDadosDestino() {

    //this.transferencia.cnpjDestino = "";
    //this.transferencia.razaoSocialDestino = "";
  }

  async recuperaContaSelecionada() {

    let self = this;
    
    let newSelectedAccount = await this.web3Service.getCurrentAccountSync();
  
    if ( !self.selectedAccount || (newSelectedAccount !== self.selectedAccount && newSelectedAccount)) {
  
      self.selectedAccount = newSelectedAccount;
      console.log("selectedAccount=" + this.selectedAccount);
      this.transferencia.contaBlockchainOrigem = newSelectedAccount+"";

      this.recuperaEmpresaOrigemPorContaBlockchain(this.transferencia.contaBlockchainOrigem);
      this.ref.detectChanges();
        
    }
  
  }  
  
  async recuperaEmpresaOrigemPorContaBlockchain(contaBlockchain) {

    let self = this;

    contaBlockchain = contaBlockchain.toLowerCase();   

    if ( contaBlockchain != undefined && contaBlockchain != "" && contaBlockchain.length == 42 ) {
      

      let cnpjConta =  (await this.web3Service.getCNPJByAddressSync(this.transferencia.contaBlockchainOrigem)); 
      
      
      
      this.transferencia.subcreditos = new Array<Subcredito>();
      await this.recuperaClientePorCNPJ(cnpjConta);

      let idConta = <number> (await this.web3Service.getRBBIDByCNPJSync(cnpjConta));
      let cliente = await this.web3Service.isClient(idConta,(this.transferencia.numeroSubcreditoSelecionado).toString());
      if(!cliente){
        let erro = "não é uma conta cliente"
        this.bnAlertsService.criarAlerta("error", "Erro",erro , 5); 
      }
      
    }
}


async recuperaClientePorCNPJ(cnpj) {
  console.log(cnpj);

  let self = this;

  let rbbID = <number> (await this.web3Service.getRBBIDByCNPJSync(parseInt(cnpj)));
  console.log(rbbID);
  if (!rbbID) {
    let s = "CNPJ não está cadastrado.";
    this.bnAlertsService.criarAlerta("error", "Erro", s, 5);
    return;
  } 
  this.transferencia.rbbIdOrigem = rbbID;

  this.pessoaJuridicaService.recuperaClientePorCnpj(cnpj).subscribe(
    empresa => {
      if (empresa && empresa.dadosCadastrais) {
        console.log("empresa encontrada abaixo ");
        console.log(empresa);

        if (empresa["subcreditos"] && empresa["subcreditos"].length>0) {

          for (var i = 0; i < empresa["subcreditos"].length; i++) {
          
            let subStr = JSON.parse(JSON.stringify(empresa["subcreditos"][i]));

            self.includeIfNotExists(self.transferencia.subcreditos, subStr);

            //TODO: otimizar para fazer isso apenas uma vez
            if (i==0) {
              self.transferencia.numeroSubcreditoSelecionado = self.transferencia.subcreditos[0].numero;
              self.atualizaInfoPorMudancaSubcredito();
            }
          }
             
        }
        else {
          let s = "O pagamento só pode ser realizado por uma empresa cliente.";
          this.bnAlertsService.criarAlerta("error", "Erro", s, 5);
          console.log(s);
        }
      }
      else {
        let texto = "Nenhuma empresa cliente encontrada com o cnpj " + cnpj;
        console.log(texto);
        Utils.criarAlertaAcaoUsuario( this.bnAlertsService, texto);

        this.inicializaDadosOrigem();
      }
    },
    error => {
      let texto = "Erro ao buscar dados da empresa";
      console.log(texto);
      Utils.criarAlertaErro( this.bnAlertsService, texto,error);
      this.inicializaDadosOrigem();
    });

}

includeIfNotExists(subcreditos, sub) {

  let include = true;
  for(var i=0; i < subcreditos.length; i++) { 
    if (subcreditos[i].numero==sub.numero) {
      include=false;
    }
  }  
  if (include) subcreditos.push(sub);
}


async atualizaInfoPorMudancaSubcredito() {

  console.log("atualiza rbbId=" + this.transferencia.rbbIdOrigem + " nSubc = " + this.transferencia.numeroSubcreditoSelecionado);

  this.transferencia.saldoOrigem = 
    await this.web3Service.getBalanceOf(this.transferencia.rbbIdOrigem, this.transferencia.numeroSubcreditoSelecionado);

  console.log(this.transferencia.saldoOrigem);

}


async recuperaFornecedor() {


  this.pessoaJuridicaHandle.cnpj = Utils.removeSpecialCharacters(this.transferencia.cnpjDestinoWithMask);
    let cnpj = this.pessoaJuridicaHandle.cnpj;

    if ( cnpj.length == 14 ) { 
      console.log (" Buscando o CNPJ  (14 digitos fornecidos)...  " + cnpj)
      this.pessoaJuridicaHandle.recuperaClientePorCNPJ();
      /*
      this.pessoaJuridicaService.recuperaEmpresaPorCnpj(cnpj).subscribe(
        empresa => {
          if (empresa && empresa.dadosCadastrais.razaoSocial) {
            console.log("empresa fornecedor encontrada - ")
            console.log(empresa)
              
            this.transferencia.razaoSocialDestino = empresa["dadosCadastrais"].razaoSocial;

          }
          else {
            let texto = "CNPJ não identificado";
            this.inicializaDadosDestino();
            console.log(texto);
            Utils.criarAlertaAcaoUsuario( this.bnAlertsService, texto);
          }
        },
        error => {
          let texto = "Erro ao buscar dados da empresa";
          this.inicializaDadosDestino();
          console.log(texto);
          Utils.criarAlertaErro( this.bnAlertsService, texto,error);
        })
*/
    }else{
      this.pessoaJuridicaHandle.razaoSocial="";
    }  

}



   async transferir() {
    ////////////////////////////////////////////////////////Verifica Cliente
    let  contaBlockchainOrigem= this.transferencia.contaBlockchainOrigem;
    let cnpjConta = <string> (await this.web3Service.getCNPJByAddressSync(contaBlockchainOrigem.toLowerCase()));
    let idConta = <number> (await this.web3Service.getRBBIDByCNPJSync(parseInt(cnpjConta)));
    let cliente = await this.web3Service.isClient(idConta,(this.transferencia.numeroSubcreditoSelecionado).toString());
    if(!cliente){
      let erro = "não é uma conta cliente";
      this.bnAlertsService.criarAlerta("error", "Erro",erro , 5);
      
      return;
    }
    ///////////////////////////////////////////////////////verifica destino
    let  fornecedorCPF = this.pessoaJuridicaHandle.cnpj;
    let idfornecedor = <number> (await this.web3Service.getRBBIDByCNPJSync(parseInt(fornecedorCPF)));
    if(!(await this.web3Service.isSupplier(idfornecedor))){
      let erro = "CNPJ nao é de um fornecedor";
      this.bnAlertsService.criarAlerta("error", "Erro",erro , 5);
      return;
    }


    if(!(await this.web3Service.isOperacional(idfornecedor))){
      let erro = "CNPJ de fornecedor não está operacional";
      this.bnAlertsService.criarAlerta("error", "Erro",erro , 5);
      return;
    }
    /////////////////////////////////////////////////

    let self = this;

    let rbbID = <number> (await this.web3Service.getRBBIDByCNPJSync(parseInt(this.pessoaJuridicaHandle.cnpj)));

    if (!rbbID) {
      let s = "CNPJ de fornecedor não está cadastrado.";
      this.bnAlertsService.criarAlerta("error", "Erro", s, 5);
      return;
    } 

    this.transferencia.rbbIdDestino = rbbID;


/*
    let bClienteOrigem = await this.web3Service.isClienteSync(this.transferencia.contaBlockchainOrigem);
    if (!bClienteOrigem) {
      let s = "Conta de Origem não é de um cliente";
      this.bnAlertsService.criarAlerta("error", "Erro", s, 5);
      return;
    }
    let bFornecedorDestino = await this.web3Service.isFornecedorSync(this.transferencia.contaBlockchainDestino);
    if (!bFornecedorDestino) {
      let s = "Conta de Destino não é de um fornecedor";
      this.bnAlertsService.criarAlerta("error", "Erro", s, 5);
      return;
    }
*/

      
    //Multipliquei por 1 para a comparacao ser do valor (e nao da string)

    
   
    if ((this.transferencia.valorTransferencia * 1) > (this.transferencia.saldoOrigem * 1)) {

      console.log("saldoOrigem=" + this.transferencia.saldoOrigem);
      console.log("valorTransferencia=" + this.transferencia.valorTransferencia);

      let s = "Não é possível transferir mais do que o valor do saldo de origem.";
      this.bnAlertsService.criarAlerta("error", "Erro", s, 5);
      return;
    }


    this.web3Service.pagaFornecedor(this.transferencia.numeroSubcreditoSelecionado+"", 
      this.transferencia.rbbIdDestino, this.transferencia.valorTransferencia).then(
      
        function(txHash) { 
          
          self.transferencia.hashOperacao = txHash;
          Utils.criarAlertasAvisoConfirmacao( txHash, 
                                              self.web3Service, 
                                              self.bnAlertsService, 
                                              "Pagamento para cnpj " + self.pessoaJuridicaHandle.cnpj + "  enviado. Aguarde a confirmação.", 
                                              "O pagamento foi confirmado na blockchain.", 
                                              self.zone);       
          self.router.navigate(['sociedade/dash-transf']);
      
        },
        function(error) {  
          Utils.criarAlertaErro( self.bnAlertsService, 
            "Erro ao transferir na blockchain", 
            error)  
      });

     Utils.criarAlertaAcaoUsuario( self.bnAlertsService, 
            "Confirme a operação no metamask e aguarde a confirmação do pagamento." )  


  }

}
