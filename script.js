
    // ==================== CONFIGURAÇÃO ====================
    const API_URL = "https://script.google.com/macros/s/AKfycby1Zykj4_wqdL6LdLZhSLMtlm2YUZmcW8XIMUhiatDwQeycYv8iKROrLJsXbyrPRXSk-A/exec";

    let usuarioLogado = null;
    let chartPizza = null;
    let chartBarras = null;
    let chartDRE = null;
    let dadosCache = { lista: [], saldoPrevio: 0 };
    let historicoDescricoes = JSON.parse(localStorage.getItem('historicoDescricoes') || '[]');

    const CLASSIFICACOES_DRE = {
      receita: { nome: 'Receita', icone: '💰', cor: '#10b981' },
      deducao: { nome: 'Deduções', icone: '📉', cor: '#f59e0b' },
      custo: { nome: 'Custos/CMV', icone: '🏭', cor: '#ef4444' },
      despesa: { nome: 'Despesas', icone: '💸', cor: '#8b5cf6' },
      outro: { nome: 'Outros', icone: '📦', cor: '#64748b' }
    };

    // ==================== FUNÇÕES AUXILIARES ====================
    function fmt(v) {
      const num = parseFloat(v) || 0;
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtNum(v) {
      const num = parseFloat(v) || 0;
      return num.toFixed(2).replace('.', ',');
    }

    function parseDate(raw) {
  if (!raw) return null;
  try {
    // 🔥 NOVO: Formato com hora (DD/MM/AAAA HH:MM)
    if (String(raw).includes("/") && String(raw).includes(":")) {
      const [datePart, timePart] = String(raw).split(" ");
      const [day, month, year] = datePart.split("/");
      const [hour, minute] = timePart.split(":");
      return new Date(year, month - 1, day, hour || 0, minute || 0);
    }
    
    if (typeof raw === 'number' || (!isNaN(raw) && !raw.includes('/') && !raw.includes('-'))) {
      const excelSerial = parseFloat(raw);
      const excelTimestamp = (excelSerial - 25569) * 86400000;
      const date = new Date(excelTimestamp);
      if (excelSerial >= 60) date.setTime(date.getTime() - 86400000);
      return date;
    }
    if (String(raw).includes("T")) return new Date(raw);
    if (String(raw).includes("/")) {
      const parts = String(raw).split("/");
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    if (String(raw).includes("-")) {
      const parts = String(raw).split("-");
      if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  } catch (e) {}
  try { const date = new Date(raw); if (!isNaN(date.getTime())) return date; } catch (e) {}
  return null;
}

   function fmtDateBR(raw) {
  try {
    const d = parseDate(raw);
    if (!d || isNaN(d.getTime())) return String(raw);
    
    // 🔥 VERIFICAR SE TEM HORA
    const horas = d.getHours();
    const minutos = d.getMinutes();
    
    // Se tiver hora diferente de meia-noite, mostra com hora
    if (horas > 0 || minutos > 0) {
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}`;
    }
    
    // Se não tiver hora, mostra só a data
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  } catch (e) { 
    return String(raw); 
  }
}
    function toInputDate(raw) {
  try {
    const d = parseDate(raw);
    if (!d || isNaN(d.getTime())) return '';
    
    // 🔥 INCLUIR HORA NO INPUT (se existir)
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    
    // Input date não suporta hora, então retornamos só a data
    return `${ano}-${mes}-${dia}`;
  } catch (e) { 
    return ''; 
  }
}

    function toggleSenha(id, btn) {
      const inp = document.getElementById(id);
      inp.type = inp.type === "password" ? "text" : "password";
      btn.textContent = inp.type === "text" ? "🙈" : "👁️";
    }

    function updateSelectColor(selectElement) {
      if (!selectElement) return;
      if (selectElement.value === "recebido") {
        selectElement.style.borderColor = "#10b981";
        selectElement.style.color = "#10b981";
      } else if (selectElement.value === "pago") {
        selectElement.style.borderColor = "#ef4444";
        selectElement.style.color = "#ef4444";
      }
    }

    function mostrarNotificacao(mensagem, tipo = 'info') {
      Swal.fire({
        text: mensagem,
        icon: tipo,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
    }

    function atualizarDataAtual() {
      const hoje = new Date();
      document.getElementById('currentDate').textContent = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    // ==================== FUNÇÕES DE API ====================
    async function chamarAPI(params) {
      return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        const urlParams = new URLSearchParams(params);
        urlParams.append('callback', callbackName);
        const url = API_URL + '?' + urlParams.toString();
        
        window[callbackName] = function(data) {
          delete window[callbackName];
          document.body.removeChild(script);
          resolve(data);
        };
        
        script.onerror = function() {
          delete window[callbackName];
          document.body.removeChild(script);
          reject({ status: 'erro', mensagem: 'Falha na comunicação' });
        };
        
        script.src = url;
        document.body.appendChild(script);
        
        setTimeout(() => {
          if (window[callbackName]) {
            delete window[callbackName];
            document.body.removeChild(script);
            reject({ status: 'erro', mensagem: 'Timeout' });
          }
        }, 8000);
      });
    }

    // ==================== LOGIN ====================
    async function verificarLogin() {
      const empresa = document.getElementById('inputEmpresa').value;
      const usuario = document.getElementById('inputUsuario').value.toLowerCase().trim();
      const senha = document.getElementById('inputSenha').value;
      const msgErro = document.getElementById('msgErro');
      const form = document.getElementById('loginForm');

      msgErro.classList.remove('show');

      if (!usuario || !senha || !empresa) {
        msgErro.innerText = '❌ Preencha todos os campos!';
        msgErro.classList.add('show');
        return;
      }

      form.style.pointerEvents = 'none';
      form.classList.add('hidden');
      document.getElementById('carregando').classList.add('show');

      try {
        const resultado = await chamarAPI({
          action: 'login',
          usuario: empresa,
          senha: senha
        });

        if (resultado && resultado.sucesso) {
          usuarioLogado = {
            usuario: empresa,
            senha: senha,
            nome: resultado.nome || empresa,
            empresaId: empresa
          };
          localStorage.setItem('supervilaSessao', JSON.stringify(usuarioLogado));
          entrarNoApp();
        } else {
          document.getElementById('carregando').classList.remove('show');
          form.classList.remove('hidden');
          form.style.pointerEvents = '';
          msgErro.innerText = '❌ Usuário ou senha inválidos!';
          msgErro.classList.add('show');
          document.getElementById('inputSenha').value = '';
          document.getElementById('inputSenha').focus();
        }
      } catch (error) {
        document.getElementById('carregando').classList.remove('show');
        form.classList.remove('hidden');
        form.style.pointerEvents = '';
        msgErro.innerText = '❌ Erro de conexão!';
        msgErro.classList.add('show');
      }
    }

    function onEmpresaChange() {
      const empresaSelect = document.getElementById('inputEmpresa');
      const usuarioInput = document.getElementById('inputUsuario');
      if (empresaSelect.value) {
        usuarioInput.value = empresaSelect.value;
        usuarioInput.readOnly = true;
        usuarioInput.style.background = '#f8fafc';
        document.getElementById('inputSenha').focus();
      } else {
        usuarioInput.readOnly = false;
        usuarioInput.style.background = '';
        usuarioInput.value = '';
      }
    }

    function entrarNoApp() {
      document.getElementById('telaLogin').classList.add('hidden');
      document.getElementById('app').classList.add('show');
      
      const nomeEmpresa = usuarioLogado.nome || usuarioLogado.usuario;
      
      document.getElementById('txtUnidade').innerText = nomeEmpresa;
      document.getElementById('topUnidade').innerText = nomeEmpresa;
      document.getElementById('sideUnidade').innerText = nomeEmpresa;
      document.getElementById('sideUsuario').innerText = usuarioLogado.usuario.charAt(0).toUpperCase();
      document.getElementById('sideUsuarioNome').innerText = nomeEmpresa.split(' ')[0];
      document.getElementById('nomeOperador').innerText = nomeEmpresa.split(' ')[0];

      atualizarDataAtual();
      configurarAtalhosLancamento();
      popularFiltrosDRE();
      popularFiltroMesAno();

      setTimeout(() => {
        carregarDescricoesSelect();
        carregarConfiguracoes();
        atualizarTabela();
        calcularDRE();
      }, 300);
    }

    function fazerLogout() {
      Swal.fire({
        title: 'Sair?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#e31d1a',
        confirmButtonText: 'Sim',
        cancelButtonText: 'Não'
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.removeItem("supervilaSessao");
          usuarioLogado = null;
          location.reload();
        }
      });
    }

    function verificarSessaoSalva() {
      const s = localStorage.getItem("supervilaSessao");
      if (!s) return;
      try {
        const d = JSON.parse(s);
        if (d.usuario && d.senha && d.nome) {
          usuarioLogado = d;
          entrarNoApp();
        }
      } catch (e) {}
    }

    // ==================== EXCLUSÃO DE LANÇAMENTO INDIVIDUAL ====================
    async function excluirLancamento(id, descricao) {
      if (!usuarioLogado) {
        mostrarNotificacao('❌ Não logado', 'error');
        return;
      }

      const result = await Swal.fire({
        title: 'Excluir lançamento?',
        html: `<p>Deseja realmente excluir:</p><strong>${descricao}</strong>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Excluindo...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      try {
        const resultado = await chamarAPI({
          action: "excluir",
          usuario: usuarioLogado.usuario,
          senha: usuarioLogado.senha,
          id: id
        });

        Swal.close();

        if (resultado && resultado.status === "ok") {
          mostrarNotificacao('✅ Lançamento excluído!', 'success');
          await atualizarTabela();
          await calcularDRE();
        } else {
          mostrarNotificacao('❌ Erro ao excluir', 'error');
        }
      } catch (error) {
        Swal.close();
        mostrarNotificacao('❌ Erro de conexão', 'error');
      }
    }

    // ==================== EXCLUSÃO DE TODOS LANÇAMENTOS COM SENHA ====================
    async function excluirTodosLancamentos() {
      if (!usuarioLogado || dadosCache.lista.length === 0) {
        mostrarNotificacao('📭 Nenhum lançamento', 'info');
        return;
      }

      // SOLICITAR SENHA PRIMEIRO
      const { value: senha } = await Swal.fire({
        title: '🔒 Confirmação de Segurança',
        text: 'Digite sua senha para excluir TODOS os lançamentos:',
        input: 'password',
        inputPlaceholder: 'Sua senha',
        inputAttributes: {
          autocapitalize: 'off',
          autocorrect: 'off'
        },
        showCancelButton: true,
        confirmButtonText: 'Verificar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e31d1a',
        inputValidator: (value) => {
          if (!value) {
            return 'Senha obrigatória!';
          }
        }
      });

      if (!senha) return; // Usuário cancelou

      // VERIFICAR SENHA
      if (senha !== usuarioLogado.senha) {
        Swal.fire({
          icon: 'error',
          title: 'Senha incorreta!',
          text: 'A senha digitada não confere.',
          confirmButtonColor: '#e31d1a'
        });
        return;
      }

      // SENHA CORRETA - PERGUNTAR CONFIRMAÇÃO
      const result = await Swal.fire({
        title: '⚠️ ATENÇÃO! ⚠️',
        html: `
          <div style="text-align: center;">
            <p style="font-size: 18px; margin-bottom: 10px;">Excluir TODOS os lançamentos?</p>
            <p style="font-size: 14px; color: #ef4444; font-weight: bold;">
              ${dadosCache.lista.length} lançamentos serão permanentemente removidos!
            </p>
            <p style="font-size: 12px; color: #64748b; margin-top: 10px;">
              Esta ação não pode ser desfeita.
            </p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: '✅ SIM, EXCLUIR TUDO',
        cancelButtonText: '❌ NÃO, CANCELAR',
        reverseButtons: true
      });

      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Excluindo lançamentos...',
        html: `Processando ${dadosCache.lista.length} registros`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      let sucessos = 0;
      let erros = 0;

      for (const item of dadosCache.lista) {
        try {
          const resultado = await chamarAPI({
            action: "excluir",
            usuario: usuarioLogado.usuario,
            senha: usuarioLogado.senha,
            id: item[0]
          });
          if (resultado && resultado.status === "ok") sucessos++;
          else erros++;
        } catch (error) {
          erros++;
        }
      }

      Swal.close();
      
      if (sucessos > 0) {
        Swal.fire({
          icon: 'success',
          title: '✅ Exclusão concluída!',
          html: `
            <p><strong>${sucessos}</strong> lançamentos excluídos com sucesso.</p>
            ${erros > 0 ? `<p style="color: #ef4444;">${erros} falhas</p>` : ''}
          `,
          confirmButtonColor: '#10b981'
        });
        await atualizarTabela();
        await calcularDRE();
      } else {
        Swal.fire({
          icon: 'error',
          title: '❌ Erro na exclusão',
          text: 'Nenhum lançamento foi excluído.',
          confirmButtonColor: '#e31d1a'
        });
      }
    }

    // ==================== DADOS ====================
    async function atualizarTabela() {
      if (!usuarioLogado) return;
      try {
        const resultado = await chamarAPI({
          action: 'ler',
          usuario: usuarioLogado.usuario,
          senha: usuarioLogado.senha
        });

        if (resultado && resultado.lista !== undefined) {
          dadosCache.lista = resultado.lista || [];
          dadosCache.saldoPrevio = parseFloat(resultado.saldoPrevio) || 0;

          atualizarCards();
          renderCards(dadosCache.lista, dadosCache.saldoPrevio);
          calcularDRE();
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    }

    function atualizarCards() {
      let tRec = 0, tPag = 0;
      dadosCache.lista.forEach((i) => {
        const recebido = parseFloat(String(i[3]).replace(",", ".")) || 0;
        const pago = parseFloat(String(i[4]).replace(",", ".")) || 0;
        tRec += recebido;
        tPag += pago;
      });

      const mov = tRec - tPag;

      document.getElementById("cardReceitas").innerText = fmt(tRec);
      document.getElementById("cardPago").innerText = fmt(tPag);
      document.getElementById("cardFluxo").innerText = fmt(mov);
      document.getElementById("cardPrevio").innerText = fmt(dadosCache.saldoPrevio);
      document.getElementById("cardSaldo").innerText = fmt(dadosCache.saldoPrevio + mov);
      document.getElementById("bannerPrevio").innerText = fmt(dadosCache.saldoPrevio);
      
      const inputSaldo = document.getElementById("inputSaldoPrevio");
      if (inputSaldo) inputSaldo.value = dadosCache.saldoPrevio.toFixed(2);

      renderGraficos(tRec, tPag);
    }

    // ==================== LANÇAMENTO ====================
    // ==================== LANÇAMENTO COM HORA ====================
async function lancar() {
  if (!usuarioLogado) {
    mostrarNotificacao('❌ Não logado', 'error');
    return;
  }

  const tipo = document.getElementById("tipoOperacao").value;
  let valor = document.getElementById("valor").value;
  const dataInput = document.getElementById("data").value;
  const tipoDRE = document.getElementById("tipoDRE").value;

  const selectDesc = document.getElementById("desc");
  const manualDesc = document.getElementById("descManual");
  let desc = selectDesc.value;

  if (desc === "manual") {
    desc = manualDesc.value.trim();
  }

  if (!desc || !valor || !dataInput) {
    mostrarNotificacao('❌ Preencha todos', 'error');
    return;
  }

  valor = valor.replace(",", ".");
  const valorNum = parseFloat(valor) || 0;

  if (valorNum <= 0) {
    mostrarNotificacao('❌ Valor inválido', 'error');
    return;
  }

  // 🔥 CAPTURAR DATA E HORA ATUAL
  const agora = new Date();
  const hora = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  const horaFormatada = `${hora}:${minutos}`;
  
  const p = dataInput.split("-");
  // 🔥 ADICIONAR HORA NO FORMATO DA DATA
  const dataFmt = `${p[2]}/${p[1]}/${p[0]} ${horaFormatada}`;

  const btn = document.getElementById("btnLancar");
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '⏳ Salvando...';
  btn.disabled = true;

  try {
    const resultado = await chamarAPI({
      action: "lancar",
      usuario: usuarioLogado.usuario,
      senha: usuarioLogado.senha,
      desc: desc,
      data: dataFmt, // 🔥 AGORA ENVIA COM HORA
      recebido: tipo === "recebido" ? valorNum : 0,
      pago: tipo === "pago" ? valorNum : 0,
      dreClass: tipoDRE
    });

    if (resultado && resultado.status === "sucesso") {
      mostrarNotificacao('✅ Salvo!', 'success');
      limparCamposLancamento();
      await atualizarTabela();
    } else {
      mostrarNotificacao('❌ Erro ao salvar', 'error');
    }
  } catch (error) {
    mostrarNotificacao('❌ Erro de conexão', 'error');
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}
    function limparCamposLancamento() {
      document.getElementById("desc").value = "";
      document.getElementById("descManual").value = "";
      document.getElementById("descManual").style.display = "none";
      document.getElementById("tipoDRE").value = "receita";
      document.getElementById("tipoOperacao").value = "recebido";
      document.getElementById("valor").value = "";
      document.getElementById("data").value = new Date().toISOString().split("T")[0];
    }

    // ==================== DESCRIÇÕES ====================
    async function carregarDescricoesSelect() {
      try {
        const resultado = await chamarAPI({ action: 'buscarDescricoes' });

        const select = document.getElementById('desc');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione...</option>';

        if (resultado.status === 'ok' && resultado.descricoes) {
          resultado.descricoes.forEach(item => {
            const option = document.createElement('option');
            option.value = item.descricao;
            option.textContent = item.descricao;
            if (item.classificacao) option.setAttribute('data-class', item.classificacao);
            select.appendChild(option);
          });
        }

        const manualOption = document.createElement('option');
        manualOption.value = "manual";
        manualOption.textContent = "✏️ Digitar...";
        select.appendChild(manualOption);
        
      } catch (error) {}
    }

    function preencherDescricao(valor) {
      const descManual = document.getElementById('descManual');
      const tipoSelect = document.getElementById('tipoOperacao');
      const dreSelect = document.getElementById('tipoDRE');
      
      if (valor === "manual") {
        descManual.style.display = 'block';
        descManual.focus();
      } else if (valor) {
        const select = document.getElementById('desc');
        const selectedOption = Array.from(select.options).find(opt => opt.value === valor);
        
        if (selectedOption && selectedOption.dataset.class) {
          dreSelect.value = selectedOption.dataset.class;
          tipoSelect.value = selectedOption.dataset.class === 'receita' ? 'recebido' : 'pago';
          updateSelectColor(tipoSelect);
        }
        
        descManual.style.display = 'none';
        descManual.value = '';
      } else {
        descManual.style.display = 'none';
      }
    }

    async function cadastrarDescricao() {
      const descricao = document.getElementById("novaDescricao").value.trim();
      const classificacao = document.getElementById("classificacaoDescricao").value;

      if (!descricao) {
        mostrarNotificacao('❌ Digite uma descrição', 'error');
        return;
      }

      try {
        const resultado = await chamarAPI({
          action: "cadastrarDescricao",
          descricao: descricao,
          classificacao: classificacao || null
        });

        if (resultado.status === "ok") {
          mostrarNotificacao('✅ Cadastrada!', 'success');
          document.getElementById("novaDescricao").value = "";
          document.getElementById("classificacaoDescricao").value = "";
          await carregarDescricoesSelect();
        }
      } catch (error) {}
    }

    // ==================== CONFIGURAÇÕES ====================
    async function carregarConfiguracoes() {
      if (!usuarioLogado) return;
      try {
        const resultado = await chamarAPI({
          action: "ler",
          usuario: usuarioLogado.usuario,
          senha: usuarioLogado.senha
        });
        
        if (resultado && resultado.saldoPrevio !== undefined) {
          const saldoPrevio = parseFloat(resultado.saldoPrevio) || 0;
          const inputSaldo = document.getElementById("inputSaldoPrevio");
          if (inputSaldo) inputSaldo.value = saldoPrevio.toFixed(2);
        }
      } catch (e) {}
    }

    async function salvarConfiguracoes() {
      if (!usuarioLogado) return;
      
      let saldo = document.getElementById("inputSaldoPrevio")?.value;
      const senha = document.getElementById("senhaConfirmacao")?.value;
      
      const msgErro = document.getElementById("msgErroConfig");
      const msgSucesso = document.getElementById("msgSucessoConfig");
      
      if (msgErro) msgErro.style.display = "none";
      if (msgSucesso) msgSucesso.style.display = "none";

      if (!saldo || !senha) {
        if (msgErro) { 
          msgErro.innerText = '❌ Preencha todos!'; 
          msgErro.style.display = 'block'; 
        }
        return;
      }

      if (senha !== usuarioLogado.senha) {
        if (msgErro) { 
          msgErro.innerText = '❌ Senha incorreta!'; 
          msgErro.style.display = 'block'; 
        }
        return;
      }

      saldo = saldo.replace(",", ".");
      const novoSaldo = parseFloat(saldo);

      if (isNaN(novoSaldo)) {
        if (msgErro) { 
          msgErro.innerText = '❌ Valor inválido!'; 
          msgErro.style.display = 'block'; 
        }
        return;
      }

      try {
        const resultado = await chamarAPI({
          action: "salvarConfig",
          usuario: usuarioLogado.usuario,
          senha: usuarioLogado.senha,
          salario: novoSaldo
        });

        if (resultado && resultado.status === "ok") {
          document.getElementById("senhaConfirmacao").value = "";
          
          if (msgSucesso) {
            msgSucesso.style.display = 'block';
            setTimeout(() => msgSucesso.style.display = 'none', 2000);
          }
          
          await atualizarTabela();
        } else {
          if (msgErro) {
            msgErro.innerText = '❌ Erro ao atualizar';
            msgErro.style.display = 'block';
          }
        }
      } catch (error) {}
    }

    // ==================== MODAL ====================
    function abrirModal(id, data, desc, rec, pag, dreClass = 'outro') {
      document.getElementById("editId").value = id;
      document.getElementById("editData").value = toInputDate(data);
      document.getElementById("editTipo").value = rec > 0 ? "recebido" : "pago";
      document.getElementById("editValor").value = rec > 0 ? rec : pag;
      document.getElementById("editTipoDRE").value = dreClass;
      updateSelectColor(document.getElementById("editTipo"));
      document.getElementById("modalEditar").classList.add("show");
      
      setTimeout(async () => {
        const descSelect = document.getElementById('editDesc');
        descSelect.innerHTML = '<option value="">Selecione...</option>';
        
        try {
          const resultado = await chamarAPI({ action: 'buscarDescricoes' });
          if (resultado.status === 'ok' && resultado.descricoes) {
            resultado.descricoes.forEach(item => {
              const option = document.createElement('option');
              option.value = item.descricao;
              option.textContent = item.descricao;
              if (item.classificacao) option.setAttribute('data-class', item.classificacao);
              descSelect.appendChild(option);
            });
          }
          
          const manualOption = document.createElement('option');
          manualOption.value = "manual";
          manualOption.textContent = "✏️ Digitar...";
          descSelect.appendChild(manualOption);
          
          const descricoesExistentes = resultado.descricoes?.map(d => d.descricao) || [];
          
          if (desc && descricoesExistentes.includes(desc)) {
            descSelect.value = desc;
          } else if (desc) {
            descSelect.value = "manual";
            document.getElementById('editDescManual').style.display = 'block';
            document.getElementById('editDescManual').value = desc;
          }
        } catch (e) {}
      }, 0);
    }

    function fecharModal() {
      document.getElementById("modalEditar").classList.remove("show");
      document.getElementById('editDescManual').style.display = 'none';
      document.getElementById('editDescManual').value = '';
    }

    async function salvarEditar() {
      if (!usuarioLogado) {
        fecharModal();
        return;
      }

      const id = document.getElementById("editId").value;
      const dataInput = document.getElementById("editData").value;
      let desc = '';
      const tipo = document.getElementById("editTipo").value;
      let valor = document.getElementById("editValor").value;
      const dreClass = document.getElementById("editTipoDRE").value;

      const descSelect = document.getElementById('editDesc');
      const descManual = document.getElementById('editDescManual');
      
      if (descSelect.value === "manual") {
        desc = descManual ? descManual.value.trim() : '';
      } else {
        desc = descSelect.value.trim();
      }

      if (!dataInput || !desc || !valor) {
        mostrarNotificacao('❌ Preencha todos', 'error');
        return;
      }

      valor = valor.replace(",", ".");
      const valorNum = parseFloat(valor) || 0;

      if (valorNum <= 0) {
        mostrarNotificacao('❌ Valor inválido', 'error');
        return;
      }

      const p = dataInput.split("-");
      const dataFmt = `${p[2]}/${p[1]}/${p[0]}`;

      try {
        const resultado = await chamarAPI({
          action: "editar",
          usuario: usuarioLogado.usuario,
          senha: usuarioLogado.senha,
          id: id,
          data: dataFmt,
          desc: desc,
          recebido: tipo === "recebido" ? valorNum : 0,
          pago: tipo === "pago" ? valorNum : 0,
          dreClass: dreClass
        });

        if (resultado && resultado.status === "ok") {
          mostrarNotificacao('✅ Editado!', 'success');
          fecharModal();
          await atualizarTabela();
          await calcularDRE();
        } else {
          mostrarNotificacao('❌ Erro ao editar', 'error');
        }
      } catch (error) {
        mostrarNotificacao('❌ Erro de conexão', 'error');
      }
    }

    // ==================== DRE ====================
    function popularFiltrosDRE() {
      const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const selM = document.getElementById("dreMes");
      const selA = document.getElementById("dreAno");
      const hoje = new Date();
      
      if (!selM || !selA) return;
      
      selM.innerHTML = '';
      meses.forEach((m, i) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = m;
        if (i === hoje.getMonth()) o.selected = true;
        selM.appendChild(o);
      });
      
      selA.innerHTML = '';
      for (let a = hoje.getFullYear(); a >= 2020; a--) {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = a;
        if (a === hoje.getFullYear()) o.selected = true;
        selA.appendChild(o);
      }
      
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      
      const inicioInput = document.getElementById("dreInicio");
      const fimInput = document.getElementById("dreFim");
      if (inicioInput) inicioInput.value = primeiroDia.toISOString().split('T')[0];
      if (fimInput) fimInput.value = ultimoDia.toISOString().split('T')[0];
    }

    function atualizarDrePeriodo() {
      const tipo = document.getElementById("drePeriodoTipo").value;
      const wrapMes = document.getElementById("dreWrapMes");
      const wrapPeriodo = document.getElementById("dreWrapPeriodo");
      
      if (tipo === "mesPersonalizado") {
        wrapMes.style.display = "flex";
        wrapPeriodo.style.display = "none";
      } else if (tipo === "periodo") {
        wrapMes.style.display = "none";
        wrapPeriodo.style.display = "flex";
      } else {
        wrapMes.style.display = "none";
        wrapPeriodo.style.display = "none";
      }
      
      calcularDRE();
    }

    function obterPeriodoDRE() {
      const tipo = document.getElementById("drePeriodoTipo").value;
      const hoje = new Date();
      let inicio, fim;
      
      switch(tipo) {
        case "mes":
          inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          break;
        case "mesPersonalizado":
          const mes = parseInt(document.getElementById("dreMes").value);
          const ano = parseInt(document.getElementById("dreAno").value);
          inicio = new Date(ano, mes, 1);
          fim = new Date(ano, mes + 1, 0);
          break;
        case "periodo":
          const i = document.getElementById("dreInicio").value;
          const f = document.getElementById("dreFim").value;
          if (!i || !f) return null;
          inicio = new Date(i + "T00:00:00");
          fim = new Date(f + "T23:59:59");
          break;
        case "ano":
          inicio = new Date(hoje.getFullYear(), 0, 1);
          fim = new Date(hoje.getFullYear(), 11, 31);
          break;
        default:
          inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      }
      return { inicio, fim };
    }

    // Modificar a função calcularDRE para chamar atualizarMargensDRE
function calcularDRE() {
  if (!dadosCache.lista || dadosCache.lista.length === 0) {
    atualizarValoresDRE(0, 0, 0, 0, 0, 0, 0);
    return;
  }
  
  const periodo = obterPeriodoDRE();
  if (!periodo) return;
  
  const registrosPeriodo = dadosCache.lista.filter(item => {
    const data = parseDate(item[1]);
    return data && data >= periodo.inicio && data <= periodo.fim;
  });
  
  let receitaBruta = 0, deducoes = 0, custos = 0, despesas = 0;
  
  registrosPeriodo.forEach(item => {
    const valor = parseFloat(String(item[3]).replace(",", ".")) - parseFloat(String(item[4]).replace(",", "."));
    const classificacao = item[5] || 'outro';
    
    if (classificacao === 'receita') receitaBruta += valor;
    else if (classificacao === 'deducao') deducoes += Math.abs(valor);
    else if (classificacao === 'custo') custos += Math.abs(valor);
    else if (classificacao === 'despesa') despesas += Math.abs(valor);
  });
  
  const receitaLiquida = receitaBruta - deducoes;
  const lucroBruto = receitaLiquida - custos;
  const lucroLiquido = lucroBruto - despesas;
  
  atualizarValoresDRE(receitaBruta, deducoes, receitaLiquida, custos, lucroBruto, despesas, lucroLiquido);
  
  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;
  
  document.getElementById("dreMargemBruta").innerText = margemBruta.toFixed(2) + '%';
  document.getElementById("dreMargemLiquida").innerText = margemLiquida.toFixed(2) + '%';
  
  // ATUALIZAR AS MARGENS BONITAS
  atualizarMargensDRE();
  
  renderGraficoDRE(receitaBruta, deducoes, custos, despesas, lucroLiquido);
  
  // Renderizar detalhamento
  renderDetalhamentoDRE(registrosPeriodo, receitaBruta, deducoes, receitaLiquida, custos, lucroBruto, despesas, lucroLiquido, margemBruta, margemLiquida);
}

    function atualizarValoresDRE(receitaBruta, deducoes, receitaLiquida, custos, lucroBruto, despesas, lucroLiquido) {
      document.getElementById("dreReceitaBruta").innerText = fmt(receitaBruta);
      document.getElementById("dreDeducoes").innerText = fmt(deducoes);
      document.getElementById("dreReceitaLiquida").innerText = fmt(receitaLiquida);
      document.getElementById("dreCustos").innerText = fmt(custos);
      document.getElementById("dreLucroBruto").innerText = fmt(lucroBruto);
      document.getElementById("dreDespesas").innerText = fmt(despesas);
      document.getElementById("dreLucroLiquido").innerText = fmt(lucroLiquido);
    }


// ==================== GRÁFICO DA DRE ====================
function renderGraficoDRE(receitaBruta, deducoes, custos, despesas, lucroLiquido) {
  const ctx = document.getElementById("graficoDRE");
  if (!ctx) return;
  
  // Destruir gráfico anterior se existir
  if (window.chartDRE) window.chartDRE.destroy();
  
  // Criar novo gráfico
  window.chartDRE = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Receita", "Deduções", "Custos", "Despesas", "Lucro"],
      datasets: [{
        label: "Valores",
        data: [receitaBruta, -deducoes, -custos, -despesas, lucroLiquido],
        backgroundColor: [
          "#10b981", // verde - receita
          "#f59e0b", // amarelo - deduções
          "#ef4444", // vermelho - custos
          "#8b5cf6", // roxo - despesas
          "#3b82f6"  // azul - lucro
        ],
        borderRadius: 6,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              let value = context.raw;
              return 'R$ ' + value.toFixed(2).replace('.', ',');
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return 'R$ ' + value.toFixed(2);
            }
          },
          grid: {
            color: '#e5e7eb'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

    function renderDetalhamentoDRE(registros, receitaBruta, deducoes, receitaLiquida, custos, lucroBruto, despesas, lucroLiquido, margemBruta, margemLiquida) {
      const container = document.getElementById("dreDetalhamento");
      
      if (!registros || registros.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhum lançamento no período</p></div>';
        return;
      }

      // Montar tabela DRE no formato simplificado
      let html = '<table class="dre-tabela">';
      html += '<tr><th class="descricao">DESCRIÇÃO</th><th class="valor">VALOR</th></tr>';
      
      // Receita Bruta
      html += `<tr><td class="descricao"><strong>RECEITA BRUTA</strong></td><td class="valor positivo"><strong>${fmt(receitaBruta)}</strong></td></tr>`;
      
      // Deduções (se houver)
      if (deducoes > 0) {
        html += `<tr><td class="descricao">(-) Deduções</td><td class="valor negativo">${fmt(-deducoes)}</td></tr>`;
      } else {
        html += `<tr><td class="descricao">(-) Deduções</td><td class="valor">R$ 0,00</td></tr>`;
      }
      
      // Receita Líquida
      html += `<tr class="total-row"><td class="descricao"><strong>= RECEITA LÍQUIDA</strong></td><td class="valor positivo"><strong>${fmt(receitaLiquida)}</strong></td></tr>`;
      
      // Custos/CMV
      if (custos > 0) {
        html += `<tr><td class="descricao">(-) Custos/CMV</td><td class="valor negativo">${fmt(-custos)}</td></tr>`;
      } else {
        html += `<tr><td class="descricao">(-) Custos/CMV</td><td class="valor">R$ 0,00</td></tr>`;
      }
      
      // Lucro Bruto
      html += `<tr class="total-row"><td class="descricao"><strong>= LUCRO BRUTO</strong></td><td class="valor ${lucroBruto >= 0 ? 'positivo' : 'negativo'}"><strong>${fmt(lucroBruto)}</strong></td></tr>`;
      
      // Despesas
      if (despesas > 0) {
        html += `<tr><td class="descricao">(-) Despesas</td><td class="valor negativo">${fmt(-despesas)}</td></tr>`;
      } else {
        html += `<tr><td class="descricao">(-) Despesas</td><td class="valor">R$ 0,00</td></tr>`;
      }
      
      // Lucro Líquido
      html += `<tr class="total-row"><td class="descricao"><strong>= LUCRO LÍQUIDO</strong></td><td class="valor ${lucroLiquido >= 0 ? 'positivo' : 'negativo'}"><strong>${fmt(lucroLiquido)}</strong></td></tr>`;
      
      html += '</table>';
      
      // Margens
      html += '<div class="dre-resumo">';
      html += `<div class="dre-resumo-item"><span class="dre-resumo-label">Margem Bruta</span><span class="dre-resumo-valor">${margemBruta.toFixed(2)}%</span></div>`;
      html += `<div class="dre-resumo-item"><span class="dre-resumo-label">Margem Líquida</span><span class="dre-resumo-valor">${margemLiquida.toFixed(2)}%</span></div>`;
      html += '</div>';
      
      // Adicionar período
      const periodo = obterPeriodoDRE();
      if (periodo) {
        const dataInicio = periodo.inicio.toLocaleDateString('pt-BR');
        const dataFim = periodo.fim.toLocaleDateString('pt-BR');
        html = `<div class="dre-periodo-info">Período: ${dataInicio} até ${dataFim}</div>` + html;
      }
      
      container.innerHTML = html;
    }

    function toggleDetalhamento() {
      const content = document.getElementById("dreDetalhamento");
      const icon = document.querySelector('.detalhamento-section .toggle-icon');
      if (content.style.display === 'none' || !content.style.display) {
        content.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
      } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
      }
    }

   
    // ==================== RENDERIZAÇÃO ====================
function renderCards(lista, saldoPrevio) {
  const container = document.getElementById("libroCards");
  
  // Atualizar os totais
  atualizarTotaisLivroCaixa();

  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><h3>Nenhum registro</h3><p>Faça um lançamento</p></div>`;
    return;
  }

  let acum = saldoPrevio, html = "";
  const listaOrdenada = [...lista].sort((a, b) => {
    const dateA = parseDate(a[1]) || new Date(0);
    const dateB = parseDate(b[1]) || new Date(0);
    return dateB - dateA;
  });

  listaOrdenada.forEach((item) => {
    const recebido = parseFloat(String(item[3]).replace(",", ".")) || 0;
    const pago = parseFloat(String(item[4]).replace(",", ".")) || 0;
    const classificacao = item[5] || 'outro';
    const isEntrada = recebido > 0;
    const valorExib = isEntrada ? recebido : pago;
    acum += recebido - pago;

    const classInfo = CLASSIFICACOES_DRE[classificacao] || CLASSIFICACOES_DRE.outro;
    const descEsc = item[2].replace(/'/g, "\\'");
    
    // 🔥 VERIFICAR SE TEM HORA PARA MOSTRAR ÍCONE DE RELÓGIO
    const dataObj = parseDate(item[1]);
    const temHora = dataObj && (dataObj.getHours() > 0 || dataObj.getMinutes() > 0);
    const iconeHora = temHora ? '🕐' : '📅';

    html += `
      <div class="entry-card ${isEntrada ? "entrada" : "saida"}">
        <div class="entry-header">
          <div class="entry-title">
            <span class="entry-desc">${item[2]}</span>
            <span class="entry-badge ${isEntrada ? "in" : "out"}">${isEntrada ? "Entrada" : "Saída"}</span>
          </div>
          <div class="entry-dre-badge" style="color: ${classInfo.cor}">
            ${classInfo.icone} ${classInfo.nome}
          </div>
        </div>
        <div class="entry-body">
          <div class="entry-meta">
            <span>${iconeHora} ${fmtDateBR(item[1])}</span>
            <span>•</span>
            <span>Saldo: <strong>${fmt(acum)}</strong></span>
          </div>
          <div class="entry-value ${isEntrada ? "in" : "out"}">
            ${isEntrada ? "+" : "-"} ${fmt(valorExib)}
          </div>
        </div>
        <div class="entry-actions">
          <button class="btn-edit" onclick="abrirModal('${item[0]}','${item[1]}','${descEsc}',${recebido},${pago},'${classificacao}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
            <span>Editar</span>
          </button>
          <button class="btn-del" onclick="excluirLancamento('${item[0]}', '${descEsc}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            <span>Excluir</span>
          </button>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

    function renderGraficos(rec, pag) {
      const ctxP = document.getElementById("graficoPizza");
      const ctxB = document.getElementById("graficoBarras");
      if (!ctxP || !ctxB) return;
      
      if (chartPizza) chartPizza.destroy();
      if (chartBarras) chartBarras.destroy();

      chartPizza = new Chart(ctxP.getContext("2d"), {
        type: "doughnut",
        data: { 
          labels: ["Entradas", "Saídas"], 
          datasets: [{ 
            data: [rec, pag], 
            backgroundColor: ["#10b981", "#ef4444"], 
            borderWidth: 0
          }] 
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: { legend: { display: false } }
        }
      });

      chartBarras = new Chart(ctxB.getContext("2d"), {
        type: "bar",
        data: { 
          labels: ["Entradas", "Saídas"], 
          datasets: [{ 
            data: [rec, pag], 
            backgroundColor: ["#10b981", "#ef4444"],
            borderRadius: 4
          }] 
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }, 
          scales: { 
            y: { 
              beginAtZero: true,
              ticks: { callback: value => 'R$ ' + value.toFixed(2) }
            }
          } 
        }
      });
    }

    // ==================== FILTROS PDF ====================
    function popularFiltroMesAno() {
      const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const selM = document.getElementById("filtroMes");
      const selA = document.getElementById("filtroMesAno");
      const hoje = new Date();
      
      if (!selM || !selA) return;
      
      meses.forEach((m, i) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = m;
        if (i === hoje.getMonth()) o.selected = true;
        selM.appendChild(o);
      });
      
      for (let a = hoje.getFullYear(); a >= 2020; a--) {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = a;
        if (a === hoje.getFullYear()) o.selected = true;
        selA.appendChild(o);
      }
    }

    // ==================== FILTROS PDF ====================
function atualizarFiltroPeriodo() {
  const tipo = document.getElementById("filtroTipo").value;
  const wrapMes = document.getElementById("wrapMes");
  const wrapPeriodo = document.getElementById("wrapPeriodo");
  
  if (tipo === "mes") {
    wrapMes.style.display = "flex";
    wrapPeriodo.style.display = "none";
  } else {
    wrapMes.style.display = "none";
    wrapPeriodo.style.display = "flex";
  }
  
  // Atualizar a lista e os totais
  if (dadosCache.lista.length > 0) {
    renderCards(dadosCache.lista, dadosCache.saldoPrevio);
  }
}

    function obterPeriodoFiltro() {
      const tipo = document.getElementById("filtroTipo").value;
      
      if (tipo === "mes") {
        const m = parseInt(document.getElementById("filtroMes").value);
        const a = parseInt(document.getElementById("filtroMesAno").value);
        return { inicio: new Date(a, m, 1), fim: new Date(a, m + 1, 0) };
      }
      
      const i = document.getElementById("filtroPeriodoInicio").value;
      const f = document.getElementById("filtroPeriodoFim").value;
      if (!i || !f) return null;
      return { inicio: new Date(i + "T00:00:00"), fim: new Date(f + "T23:59:59") };
    }

    // ==================== PDF ====================
    // ==================== PDF DO LIVRO DE CAIXA BONITÃO ====================
async function gerarPDFLivroCaixa() {
  if (!usuarioLogado) return;
  
  const periodo = obterPeriodoFiltro();
  if (!periodo) {
    Swal.fire('Período inválido!', '', 'warning');
    return;
  }

  const filtrada = dadosCache.lista.filter((item) => {
    const d = parseDate(item[1]);
    return d && d >= periodo.inicio && d <= periodo.fim;
  });

  if (!filtrada.length) {
    Swal.fire('Nenhum registro', '', 'info');
    return;
  }

  filtrada.sort((a, b) => parseDate(a[1]) - parseDate(b[1]));

  let totalRecebido = 0;
  let totalPago = 0;

  filtrada.forEach(i => {
    totalRecebido += parseFloat(String(i[3]).replace(",", ".")) || 0;
    totalPago += parseFloat(String(i[4]).replace(",", ".")) || 0;
  });
  
  const saldoMovimento = totalRecebido - totalPago;
  const saldoFinal = dadosCache.saldoPrevio + saldoMovimento;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Cabeçalho com logo (textual mesmo)
  doc.setFillColor(227, 29, 26); // Vermelho Supervila
  doc.rect(0, 0, 210, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LIVRO DE CAIXA', 105, 12, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(usuarioLogado.nome.toUpperCase(), 105, 20, { align: 'center' });
  
  // Linha decorativa
  doc.setDrawColor(227, 29, 26);
  doc.setLineWidth(0.5);
  doc.line(20, 30, 190, 30);
  
  // Período
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Período:', 20, 40);
  doc.setFont('helvetica', 'normal');
  
  const fD = d => d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '';
  doc.text(`${fD(periodo.inicio)} até ${fD(periodo.fim)}`, 50, 40);
  
  // Tabela de lançamentos
  const body = [["DATA", "DESCRIÇÃO", "RECEBIDO", "PAGO", "SALDO"]];
  let acum = dadosCache.saldoPrevio;
  
  filtrada.forEach(item => {
    const recebido = parseFloat(String(item[3]).replace(",", ".")) || 0;
    const pago = parseFloat(String(item[4]).replace(",", ".")) || 0;
    acum += recebido - pago;
    const d = parseDate(item[1]);
    
    body.push([
      d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}` : '',
      item[2] || '-',
      recebido > 0 ? this.formatarMoedaPDF(recebido) : '',
      pago > 0 ? this.formatarMoedaPDF(pago) : '',
      this.formatarMoedaPDF(acum)
    ]);
  });

  doc.autoTable({
    startY: 48,
    head: [body[0]],
    body: body.slice(1),
    theme: 'grid',
    styles: { 
      fontSize: 8, 
      cellPadding: 3,
      font: 'helvetica',
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    headStyles: { 
      fillColor: [227, 29, 26], 
      textColor: 255, 
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    }
  });

  // Posição para os totais
  const finalY = doc.lastAutoTable.finalY + 10;
  
  // Linha separadora
  doc.setDrawColor(227, 29, 26);
  doc.setLineWidth(0.5);
  doc.line(20, finalY - 5, 190, finalY - 5);
  
  // Container dos totais (fundo cinza claro)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, finalY, 170, 65, 3, 3, 'F');
  
  // Título da seção de totais
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(227, 29, 26);
  doc.text('📊 RESUMO FINANCEIRO', 105, finalY + 7, { align: 'center' });
  
  // Totais em formato de grid
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  
  // Coluna 1
  doc.text('TOTAL RECEBIDO:', 30, finalY + 18);
  doc.text('TOTAL PAGO:', 30, finalY + 28);
  doc.text('SALDO MOVIMENTAÇÃO:', 30, finalY + 38);
  
  // Coluna 2
  doc.text('SALDO PRÉVIO:', 110, finalY + 18);
  doc.text('SALDO FINAL:', 110, finalY + 28);
  
  // Valores (alinhados à direita)
  doc.setFont('helvetica', 'normal');
  
  // Valores coluna 1
  doc.text(this.formatarMoedaPDF(totalRecebido), 85, finalY + 18, { align: 'right' });
  doc.text(this.formatarMoedaPDF(totalPago), 85, finalY + 28, { align: 'right' });
  doc.text(this.formatarMoedaPDF(saldoMovimento), 85, finalY + 38, { align: 'right' });
  
  // Valores coluna 2
  doc.text(this.formatarMoedaPDF(dadosCache.saldoPrevio), 165, finalY + 18, { align: 'right' });
  
  // Saldo final em destaque
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(saldoFinal >= 0 ? 5 : 220, saldoFinal >= 0 ? 150 : 38, saldoFinal >= 0 ? 105 : 38);
  doc.text(this.formatarMoedaPDF(saldoFinal), 165, finalY + 28, { align: 'right' });
  
  // Indicador de status
  const statusText = totalRecebido > totalPago ? 'SUPERÁVIT ✨' : totalRecebido < totalPago ? 'DÉFICIT ⚠️' : 'EQUILÍBRIO ✅';
  const statusColor = totalRecebido > totalPago ? [16, 185, 129] : totalRecebido < totalPago ? [239, 68, 68] : [100, 100, 100];
  
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(130, finalY + 40, 50, 12, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, 155, finalY + 48, { align: 'center' });
  
  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'italic');
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  doc.text(`Documento gerado em ${dataEmissao} pelo Sistema DRE Supervila`, 105, 280, { align: 'center' });

  doc.save(`Livro_Caixa_${usuarioLogado.nome.replace(' ', '_')}.pdf`);
  Swal.fire({
    icon: 'success',
    title: '✅ PDF gerado com sucesso!',
    text: 'O arquivo foi baixado para seu computador.',
    confirmButtonColor: '#10b981'
  });
}

// Função auxiliar para formatar moeda no PDF
function formatarMoedaPDF(valor) {
  return valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
    async function gerarPDFDRE() {
      if (!usuarioLogado) return;
      
      const periodo = obterPeriodoDRE();
      if (!periodo) {
        Swal.fire('Período inválido!', '', 'warning');
        return;
      }

      const registrosPeriodo = dadosCache.lista.filter(item => {
        const data = parseDate(item[1]);
        return data && data >= periodo.inicio && data <= periodo.fim;
      });
      
      let receitaBruta = 0, deducoes = 0, custos = 0, despesas = 0;
      
      registrosPeriodo.forEach(item => {
        const valor = parseFloat(String(item[3]).replace(",", ".")) - parseFloat(String(item[4]).replace(",", "."));
        const classificacao = item[5] || 'outro';
        
        if (classificacao === 'receita') receitaBruta += valor;
        else if (classificacao === 'deducao') deducoes += Math.abs(valor);
        else if (classificacao === 'custo') custos += Math.abs(valor);
        else if (classificacao === 'despesa') despesas += Math.abs(valor);
      });
      
      const receitaLiquida = receitaBruta - deducoes;
      const lucroBruto = receitaLiquida - custos;
      const lucroLiquido = lucroBruto - despesas;
      const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
      const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text(`DEMONSTRAÇÃO DO RESULTADO - ${usuarioLogado.nome.toUpperCase()}`, 105, 15, { align: "center" });
      doc.setFontSize(10);
      
      const fD = d => d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '';
      doc.text(`Período: ${fD(periodo.inicio)} até ${fD(periodo.fim)}`, 105, 22, { align: "center" });

      // Montar corpo da tabela no formato simplificado
      const body = [
        ["RECEITA BRUTA", `R$ ${receitaBruta.toFixed(2).replace('.', ',')}`],
        ["(-) Deduções", `R$ ${deducoes.toFixed(2).replace('.', ',')}`],
        ["= RECEITA LÍQUIDA", `R$ ${receitaLiquida.toFixed(2).replace('.', ',')}`],
        ["(-) Custos/CMV", `R$ ${custos.toFixed(2).replace('.', ',')}`],
        ["= LUCRO BRUTO", `R$ ${lucroBruto.toFixed(2).replace('.', ',')}`],
        ["(-) Despesas", `R$ ${despesas.toFixed(2).replace('.', ',')}`],
        ["= LUCRO LÍQUIDO", `R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`],
        ["", ""],
        ["MARGEM BRUTA", `${margemBruta.toFixed(2)}%`],
        ["MARGEM LÍQUIDA", `${margemLiquida.toFixed(2)}%`]
      ];

      doc.autoTable({
        startY: 30,
        head: [["DESCRIÇÃO", "VALOR"]],
        body: body,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [227, 29, 26], textColor: 255, fontSize: 11 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 60, halign: 'right' }
        }
      });

      doc.save(`DRE_${usuarioLogado.nome.replace(' ', '_')}.pdf`);
      Swal.fire(`✅ PDF gerado!`, '', 'success');
    }

    // ==================== UTILITÁRIOS ====================
    function mudarTab(id, el) {
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      document.getElementById("tab-" + id).classList.add("active");

      document.querySelectorAll(".bottom-nav .nav-btn, .sidebar .nav-item").forEach(b => b.classList.remove("active"));
      if (el) el.classList.add("active");

      document.querySelector(".content-scroll").scrollTop = 0;

      if (id === "lancar") setTimeout(() => carregarDescricoesSelect(), 50);
      if (id === "dre") setTimeout(() => calcularDRE(), 50);
    }

    function configurarAtalhosLancamento() {
      document.getElementById("valor")?.addEventListener("keypress", e => e.key === "Enter" && lancar());
    }

    // ==================== INICIALIZAÇÃO ====================
    window.addEventListener("DOMContentLoaded", () => {
      document.getElementById("data").value = new Date().toISOString().split('T')[0];
      popularFiltroMesAno();
      popularFiltrosDRE();
      verificarSessaoSalva();
      
      ["tipoOperacao", "editTipo"].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
          updateSelectColor(select);
          select.addEventListener("change", function() { updateSelectColor(this); });
        }
      });
      
      ["drePeriodoTipo", "dreMes", "dreAno", "dreInicio", "dreFim"].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => calcularDRE());
      });
    });

    window.addEventListener("resize", () => {
      setTimeout(() => {
        const rec = parseFloat(document.getElementById("cardReceitas")?.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
        const pag = parseFloat(document.getElementById("cardPago")?.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
        if (rec > 0 || pag > 0) renderGraficos(rec, pag);
        calcularDRE();
      }, 200);
    });
    
// ==================== TOTAIS DO LIVRO DE CAIXA ====================

function atualizarTotaisLivroCaixa() {
  const periodo = obterPeriodoFiltro();
  if (!periodo) return;

  const registrosFiltrados = dadosCache.lista.filter(item => {
    const data = parseDate(item[1]);
    return data && data >= periodo.inicio && data <= periodo.fim;
  });

  let totalRecebido = 0;
  let totalPago = 0;

  registrosFiltrados.forEach(item => {
    totalRecebido += parseFloat(String(item[3]).replace(",", ".")) || 0;
    totalPago += parseFloat(String(item[4]).replace(",", ".")) || 0;
  });

  const saldoMovimento = totalRecebido - totalPago;
  const saldoFinal = dadosCache.saldoPrevio + saldoMovimento;

  // Criar/atualizar o container de totais
  let totaisContainer = document.getElementById('livroTotais');
  if (!totaisContainer) {
    totaisContainer = document.createElement('div');
    totaisContainer.id = 'livroTotais';
    totaisContainer.className = 'livro-totais';
    
    const libroCards = document.getElementById('libroCards');
    if (libroCards) {
      libroCards.insertAdjacentElement('beforebegin', totaisContainer);
    }
  }

  // Formatar período de forma compacta para mobile
  const periodoInicio = periodo.inicio.toLocaleDateString('pt-BR');
  const periodoFim = periodo.fim.toLocaleDateString('pt-BR');
  const periodoCompacto = window.innerWidth < 480 ? 
    `${periodoInicio} - ${periodoFim}` : 
    `${periodoInicio} até ${periodoFim}`;
  
  // Calcular percentuais
  const totalGeral = totalRecebido + totalPago;
  const percRecebido = totalGeral > 0 ? ((totalRecebido / totalGeral) * 100).toFixed(1) : 0;
  const percPago = totalGeral > 0 ? ((totalPago / totalGeral) * 100).toFixed(1) : 0;
  
  // Determinar status
  const status = totalRecebido > totalPago ? 'superavit' : totalRecebido < totalPago ? 'deficit' : 'equilibrio';
  const statusText = totalRecebido > totalPago ? 'SUPERÁVIT' : totalRecebido < totalPago ? 'DÉFICIT' : 'EQUILÍBRIO';
  const statusIcon = totalRecebido > totalPago ? '📈' : totalRecebido < totalPago ? '📉' : '⚖️';
  const statusEmoji = totalRecebido > totalPago ? '✨' : totalRecebido < totalPago ? '⚠️' : '✅';

  totaisContainer.innerHTML = `
    <div class="livro-totais-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
      <h4>📊 RESUMO • ${periodoCompacto}</h4>
    </div>
    
    <div class="livro-totais-grid">
      <!-- TOTAL RECEBIDO -->
      <div class="totais-card">
        <div class="totais-icon recebido">💰</div>
        <div class="totais-content">
          <span class="totais-label">RECEBIDO</span>
          <span class="totais-valor recebido">${fmt(totalRecebido)}</span>
          <div class="totais-detalhe">
            <span>📊 ${percRecebido}%</span>
            <span>📈 +${fmt(totalRecebido)}</span>
          </div>
        </div>
      </div>
      
      <!-- TOTAL PAGO -->
      <div class="totais-card">
        <div class="totais-icon pago">💸</div>
        <div class="totais-content">
          <span class="totais-label">PAGO</span>
          <span class="totais-valor pago">${fmt(totalPago)}</span>
          <div class="totais-detalhe">
            <span>📊 ${percPago}%</span>
            <span>📉 -${fmt(totalPago)}</span>
          </div>
        </div>
      </div>
      
      <!-- SALDO MOVIMENTAÇÃO -->
      <div class="totais-card">
        <div class="totais-icon movimento">📊</div>
        <div class="totais-content">
          <span class="totais-label">MOVIMENTO</span>
          <span class="totais-valor movimento">${fmt(saldoMovimento)}</span>
          <div class="totais-detalhe">
            <span>${saldoMovimento > 0 ? '💰' : saldoMovimento < 0 ? '💸' : '⚖️'}</span>
            <span>${saldoMovimento > 0 ? '+' : ''}${fmt(saldoMovimento)}</span>
          </div>
        </div>
      </div>
      
      <!-- SALDO FINAL -->
      <div class="totais-card">
        <div class="totais-icon saldo-final">🏦</div>
        <div class="totais-content">
          <span class="totais-label">SALDO FINAL</span>
          <span class="totais-valor saldo-final">${fmt(saldoFinal)}</span>
          <div class="totais-detalhe">
            <span>📅 ${periodoFim}</span>
            <span>${saldoFinal > 0 ? '💰' : saldoFinal < 0 ? '💸' : '⚖️'}</span>
          </div>
        </div>
      </div>
      
      <!-- RESUMO - OCUPA LINHA INTEIRA -->
      <div class="livro-resumo">
        <div class="livro-resumo-item">
          <span class="livro-resumo-label">ENTRADAS VS SAÍDAS</span>
          <span class="livro-resumo-valor">${fmt(totalRecebido)} / ${fmt(totalPago)}</span>
        </div>
        <div class="livro-resumo-badge ${status}">
          <span>${statusIcon}</span>
          <span>${statusText}</span>
          <span>${statusEmoji}</span>
        </div>
      </div>
    </div>
  `;
}
// ==================== MARGENS DA DRE ====================
function atualizarMargensDRE() {
  // Pegar os valores das margens dos elementos existentes
  const margemBrutaElement = document.getElementById('dreMargemBruta');
  const margemLiquidaElement = document.getElementById('dreMargemLiquida');
  
  if (!margemBrutaElement || !margemLiquidaElement) return;
  
  // Extrair os valores (remover o % e converter para número)
  const margemBruta = parseFloat(margemBrutaElement.innerText.replace('%', '')) || 0;
  const margemLiquida = parseFloat(margemLiquidaElement.innerText.replace('%', '')) || 0;
  
  // Determinar status das margens
  const getStatus = (margem) => {
    if (margem >= 30) return { text: 'Excelente', class: 'excelente', icon: '🌟' };
    if (margem >= 15) return { text: 'Boa', class: 'boa', icon: '👍' };
    if (margem >= 5) return { text: 'Regular', class: 'regular', icon: '📊' };
    return { text: 'Atenção', class: 'regular', icon: '⚠️' };
  };
  
  const statusBruta = getStatus(margemBruta);
  const statusLiquida = getStatus(margemLiquida);
  
  // Criar/atualizar o container de margens
  let margensContainer = document.getElementById('margensContainer');
  
  if (!margensContainer) {
    margensContainer = document.createElement('div');
    margensContainer.id = 'margensContainer';
    margensContainer.className = 'margens-container';
    
    // Inserir após as margens existentes ou antes do detalhamento
    const marginsSection = document.querySelector('.margins-section');
    if (marginsSection) {
      marginsSection.insertAdjacentElement('afterend', margensContainer);
    } else {
      const dreCards = document.querySelector('.dre-cards');
      if (dreCards) {
        dreCards.insertAdjacentElement('afterend', margensContainer);
      }
    }
  }
  
  // Calcular ângulos para os gráficos circulares (0-100%)
  const anguloBruta = (margemBruta / 100) * 360;
  const anguloLiquida = (margemLiquida / 100) * 360;
  
  margensContainer.innerHTML = `
    <div class="margens-header">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12v-2a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v2"/>
        <circle cx="12" cy="16" r="5"/>
        <path d="M12 11v5"/>
        <path d="M9 8V6"/>
        <path d="M15 8V6"/>
      </svg>
      <h4>📈 ANÁLISE DE MARGENS</h4>
    </div>
    
    <div class="margens-grid">
      <!-- MARGEM BRUTA -->
      <div class="margem-card bruta">
        <div class="margem-icon bruta">📊</div>
        <div class="margem-content">
          <span class="margem-label">MARGEM BRUTA</span>
          <div class="margem-valor bruta">
            ${margemBruta.toFixed(2)}<span class="margem-percentual">%</span>
          </div>
          <div class="margem-status ${statusBruta.class}">
            <span>${statusBruta.icon}</span>
            <span>${statusBruta.text}</span>
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
            ${margemBruta >= 30 ? '✨ Performance excelente' : 
              margemBruta >= 15 ? '✅ Performance satisfatória' : 
              margemBruta >= 5 ? '📊 Performance regular' : '⚠️ Necessita atenção'}
          </div>
        </div>
        <div class="margem-grafico">
          <svg viewBox="0 0 60 60">
            <circle class="margem-grafico-bg" cx="30" cy="30" r="25" stroke="#e2e8f0" fill="none" stroke-width="6"/>
            <circle class="margem-grafico-fill bruta" cx="30" cy="30" r="25" 
                    stroke="#10b981" fill="none" stroke-width="6"
                    stroke-dasharray="157" 
                    stroke-dashoffset="${157 - (157 * margemBruta / 100)}"/>
          </svg>
          <div class="margem-grafico-texto">${Math.round(margemBruta)}%</div>
        </div>
      </div>
      
      <!-- MARGEM LÍQUIDA -->
      <div class="margem-card liquida">
        <div class="margem-icon liquida">📈</div>
        <div class="margem-content">
          <span class="margem-label">MARGEM LÍQUIDA</span>
          <div class="margem-valor liquida">
            ${margemLiquida.toFixed(2)}<span class="margem-percentual">%</span>
          </div>
          <div class="margem-status ${statusLiquida.class}">
            <span>${statusLiquida.icon}</span>
            <span>${statusLiquida.text}</span>
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
            ${margemLiquida >= 20 ? '✨ Lucratividade excelente' : 
              margemLiquida >= 10 ? '✅ Lucratividade boa' : 
              margemLiquida >= 3 ? '📊 Lucratividade regular' : '⚠️ Baixa lucratividade'}
          </div>
        </div>
        <div class="margem-grafico">
          <svg viewBox="0 0 60 60">
            <circle class="margem-grafico-bg" cx="30" cy="30" r="25" stroke="#e2e8f0" fill="none" stroke-width="6"/>
            <circle class="margem-grafico-fill liquida" cx="30" cy="30" r="25" 
                    stroke="#8b5cf6" fill="none" stroke-width="6"
                    stroke-dasharray="157" 
                    stroke-dashoffset="${157 - (157 * margemLiquida / 100)}"/>
          </svg>
          <div class="margem-grafico-texto">${Math.round(margemLiquida)}%</div>
        </div>
      </div>
    </div>
    
    <!-- LEGENDA -->
    <div style="display: flex; gap: 20px; justify-content: center; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #e2e8f0; font-size: 11px; color: #64748b;">
      <span>🌟 Excelente (≥30%)</span>
      <span>✅ Bom (15-29%)</span>
      <span>📊 Regular (5-14%)</span>
      <span>⚠️ Atenção (&lt;5%)</span>
    </div>
  `;
}


// ==================== PWA INSTALL PROMPT ====================
let deferredPrompt;
const installButton = document.createElement('button');

// Criar botão de instalação flutuante
function createInstallButton() {
  installButton.id = 'install-button';
  installButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>Instalar App</span>
  `;
  
  installButton.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #e31d1a;
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 20px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 600;
    display: none;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(227, 29, 26, 0.3);
    cursor: pointer;
    z-index: 1000;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.2);
  `;
  
  installButton.addEventListener('mouseenter', () => {
    installButton.style.transform = 'translateY(-2px)';
    installButton.style.boxShadow = '0 6px 16px rgba(227, 29, 26, 0.4)';
  });
  
  installButton.addEventListener('mouseleave', () => {
    installButton.style.transform = 'translateY(0)';
    installButton.style.boxShadow = '0 4px 12px rgba(227, 29, 26, 0.3)';
  });
  
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuário aceitou instalar o app');
      installButton.style.display = 'none';
    }
    
    deferredPrompt = null;
  });
  
  document.body.appendChild(installButton);
}

// Detectar quando o app pode ser instalado
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Mostrar botão de instalação apenas se o app não estiver instalado
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    installButton.style.display = 'flex';
  }
});

// Detectar quando o app foi instalado
window.addEventListener('appinstalled', () => {
  console.log('App instalado com sucesso!');
  installButton.style.display = 'none';
  deferredPrompt = null;
});

// Verificar se já está instalado
window.addEventListener('load', () => {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('App rodando em modo standalone');
    // Adicionar classe para ajustes no modo app
    document.body.classList.add('app-mode');
  }
});

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registrado com sucesso:', registration.scope);
      })
      .catch(error => {
        console.log('Falha no registro do ServiceWorker:', error);
      });
  });
}

// Detectar conexão com internet
window.addEventListener('online', () => {
  document.body.classList.remove('offline');
  if (typeof mostrarNotificacao === 'function') {
    mostrarNotificacao('✅ Conexão restabelecida', 'success');
  }
});

window.addEventListener('offline', () => {
  document.body.classList.add('offline');
  if (typeof mostrarNotificacao === 'function') {
    mostrarNotificacao('📴 Modo offline - Dados podem estar desatualizados', 'warning');
  }
});

// Inicializar botão de instalação
createInstallButton();

// Adicionar CSS para modo offline e app mode
const style = document.createElement('style');
style.textContent = `
  .offline .content-scroll {
    opacity: 0.8;
  }
  
  .app-mode {
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  .app-mode .bottom-nav {
    padding-bottom: max(env(safe-area-inset-bottom), 8px);
  }
  
  @media (min-width: 1024px) {
    #install-button {
      bottom: 30px;
      right: 30px;
    }
  }
  
  @media (max-width: 480px) {
    #install-button {
      bottom: 70px;
      right: 15px;
      padding: 10px 16px;
      font-size: 13px;
    }
    
    #install-button svg {
      width: 18px;
      height: 18px;
    }
  }
`;
document.head.appendChild(style);

    // Exportar funções
    window.toggleSenha = toggleSenha;
    window.verificarLogin = verificarLogin;
    window.onEmpresaChange = onEmpresaChange;
    window.mudarTab = mudarTab;
    window.fazerLogout = fazerLogout;
    window.lancar = lancar;
    window.limparCamposLancamento = limparCamposLancamento;
    window.preencherDescricao = preencherDescricao;
    window.cadastrarDescricao = cadastrarDescricao;
    window.salvarConfiguracoes = salvarConfiguracoes;
    window.atualizarFiltroPeriodo = atualizarFiltroPeriodo;
    window.gerarPDFLivroCaixa = gerarPDFLivroCaixa;
    window.gerarPDFDRE = gerarPDFDRE;
    window.abrirModal = abrirModal;
    window.fecharModal = fecharModal;
    window.salvarEditar = salvarEditar;
    window.atualizarDrePeriodo = atualizarDrePeriodo;
    window.toggleDetalhamento = toggleDetalhamento;
    window.excluirTodosLancamentos = excluirTodosLancamentos;
    window.excluirLancamento = excluirLancamento;

  
  
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

// ==================== CORREÇÕES PARA CELULAR ====================
function fixMobileViewport() {
  // Corrigir o problema do viewport em alguns celulares
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  
  // Ajustar a altura da tela de login
  const telaLogin = document.getElementById('telaLogin');
  if (telaLogin) {
    telaLogin.style.minHeight = `${window.innerHeight}px`;
  }
  
  // Ajustar o conteúdo principal
  const app = document.getElementById('app');
  if (app && app.classList.contains('show')) {
    app.style.minHeight = `${window.innerHeight}px`;
  }
}

// Detectar se é celular
function isMobile() {
  return window.innerWidth <= 768;
}

// Ajustar quando a tela mudar de tamanho (rotação)
window.addEventListener('resize', () => {
  fixMobileViewport();
  
  // Re-renderizar gráficos se necessário
  if (isMobile()) {
    setTimeout(() => {
      const rec = parseFloat(document.getElementById("cardReceitas")?.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
      const pag = parseFloat(document.getElementById("cardPago")?.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
      if (rec > 0 || pag > 0) renderGraficos(rec, pag);
    }, 100);
  }
});

// Executar quando a página carregar
window.addEventListener('load', () => {
  fixMobileViewport();
  
  // Se for celular, fazer ajustes adicionais
  if (isMobile()) {
    document.body.classList.add('is-mobile');
    
    // Ajustar a rolagem
    document.querySelector('.content-scroll')?.addEventListener('touchstart', () => {}, { passive: true });
  }
});

// Executar também quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', fixMobileViewport);

// ==================== CORREÇÃO PARA O BOTÃO DE LOGIN NO CELULAR ====================
// Garantir que o teclado não esconda o campo de senha
const senhaInput = document.getElementById('inputSenha');
if (senhaInput) {
  senhaInput.addEventListener('focus', () => {
    setTimeout(() => {
      senhaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  });
}
