const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const generateId = () => require('crypto').randomUUID();

const mapId = '498e4e08-2a41-4b5f-a839-5098d41bd363';

// Existing Node IDs
const idSetembro = 'be2fc076-f2da-446f-819b-65c68bf6bbe5';
const idOutubro = '94b35f7f-e01d-4abd-837d-2d1818a5719a';
const idNovembro = 'ca27fd2d-2cd2-49fc-845c-0681e992fa3a';
const idModosAquisi = '1a46d223-ea5c-420e-8535-fe8c9e9881a6';
const idProcessoVendas = '6f551a80-b731-47c0-8063-8da6f97ba5fd';
const idSuporte = '47b0050b-6599-4da0-9159-70c8153c7060';
const idVisaoMetas = '14b13344-7d53-423a-bf8c-4a07f6870425';

const newNodes = [];
const newEdges = [];

function createNodeWithEdge(text, parentId, x, y, order = 0) {
    const id = generateId();
    newNodes.push({ id, map_id: mapId, text, parent_id: parentId, x, y, color: JSON.stringify({}), order });
    newEdges.push({ id: generateId(), map_id: mapId, source: parentId, target: id, color: '#a855f7' });
    return id;
}

async function run() {
    // 1. Missing children for Setembro
    const setChildren = [
        "Validar o produto.",
        "Validar o processo comercial.",
        "Validar o onboarding.",
        "Implantar pesquisas de satisfação."
    ];
    setChildren.forEach((text, i) => createNodeWithEdge(text, idSetembro, 500, -200 + (i * 30), i));

    // 2. Missing child for Outubro
    createNodeWithEdge("Aprimorar a cadência comercial.", idOutubro, 500, -100, 0);

    // 3. Missing children for Novembro
    const novChildren = [
        "Validar os canais de aquisição com maior retorno.",
        "Criar materiais de apoio para vendas.",
        "Estruturar uma base de CONHECIMENTO."
    ];
    novChildren.forEach((text, i) => createNodeWithEdge(text, idNovembro, 500, 0 + (i * 30), i));

    // 4. Modos de Aquisição de Clientes -> Definir ICP -> (existing children)
    const idICP = createNodeWithEdge("Definir ICP (Ideal Customer Profile) - Cliente Ideal", idModosAquisi, 300, 150, 0);
    // Update existing children of Modos to point to ICP
    const { data: modosChildren } = await supabase.from('nodes').select('id').eq('parent_id', idModosAquisi);
    const modosChildrenIds = modosChildren.filter(n => n.id !== idICP).map(n => n.id);
    if(modosChildrenIds.length > 0) {
        await supabase.from('nodes').update({ parent_id: idICP }).in('id', modosChildrenIds);
        await supabase.from('edges').update({ source: idICP }).in('target', modosChildrenIds);
    }

    // 5. Processo de Vendas -> Missing nodes
    createNodeWithEdge("CRM Comercial: Área específica dentro da aba administrativa do sistema para gerenciamento completo do processo comercial.", idProcessoVendas, 300, 200, 0);
    
    const idInd = createNodeWithEdge("Indicadores (KPIs e Metas)", idProcessoVendas, 300, 230, 1);
    createNodeWithEdge("Acompanhar semanalmente indicadores", idInd, 500, 230, 0);

    const idOnb = createNodeWithEdge("Onboarding e Retenção", idProcessoVendas, 300, 260, 2);
    const idMetaInt = createNodeWithEdge("Meta interna: Todo cliente precisa conseguir:", idOnb, 500, 260, 0);
    const onbChildren = ["Cadastrar imóvel.", "Cadastrar corretor.", "Receber lead.", "Enviar imóvel."];
    onbChildren.forEach((text, i) => createNodeWithEdge(text, idMetaInt, 700, 260 + (i * 30), i));

    const idRoad = createNodeWithEdge("Roadmap Comercial e do Produto", idProcessoVendas, 300, 290, 3);
    const roadChildren = ["Pesquisa de Satisfação", "Roadmap de Produto", "Plano de Expansão"];
    roadChildren.forEach((text, i) => createNodeWithEdge(text, idRoad, 500, 290 + (i * 30), i));

    // 6. Suporte -> Definir qual será o canal -> (existing children)
    const idCanal = createNodeWithEdge("Definir qual será o canal oficial de atendimento: Chatswoot ou WhatsApp.", idSuporte, 300, 320, 0);
    const { data: supChildren } = await supabase.from('nodes').select('id').eq('parent_id', idSuporte);
    const supChildrenIds = supChildren.filter(n => n.id !== idCanal).map(n => n.id);
    if(supChildrenIds.length > 0) {
        await supabase.from('nodes').update({ parent_id: idCanal }).in('id', supChildrenIds);
        await supabase.from('edges').update({ source: idCanal }).in('target', supChildrenIds);
    }

    // 7. Visão e metas do Chave Reserva -> Metas por Atividade -> (months)
    // First, create the node Metas por Atividade
    const idMetas = createNodeWithEdge("Metas por Atividade", idVisaoMetas, 300, -100, 0);
    
    // Now move all months to be children of idMetas (except idMetas itself!)
    const { data: visaoChildren } = await supabase.from('nodes').select('id').eq('parent_id', idVisaoMetas);
    const monthsIds = visaoChildren.filter(n => n.id !== idMetas).map(n => n.id);
    if(monthsIds.length > 0) {
        await supabase.from('nodes').update({ parent_id: idMetas }).in('id', monthsIds);
        await supabase.from('edges').update({ source: idMetas }).in('target', monthsIds);
    }

    // Insert everything
    const { error: errNodes } = await supabase.from('nodes').insert(newNodes);
    if (errNodes) console.error("Error inserting nodes:", errNodes);
    else console.log(`Inserted ${newNodes.length} nodes successfully.`);

    const { error: errEdges } = await supabase.from('edges').insert(newEdges);
    if (errEdges) console.error("Error inserting edges:", errEdges);
    else console.log(`Inserted ${newEdges.length} edges successfully.`);
}

run();
