const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const generateId = () => {
    return require('crypto').randomUUID();
};

const mapId = '498e4e08-2a41-4b5f-a839-5098d41bd363';
const rootAlessandroId = 'a22f1d94-ab00-45c7-a699-800807064cc4';
const roadmapId = '14b13344-7d53-423a-bf8c-4a07f6870425';

const newNodes = [];
const newEdges = [];

function createNodeWithEdge(text, parentId, x, y, order = 0) {
    const id = generateId();
    newNodes.push({
        id,
        map_id: mapId,
        text,
        parent_id: parentId,
        x,
        y,
        color: JSON.stringify({}),
        order
    });
    newEdges.push({
        id: generateId(),
        map_id: mapId,
        source: parentId,
        target: id,
        color: '#a855f7'
    });
    return id;
}

async function run() {
    // 1. Add Agosto and its children to Roadmap
    const agostoId = createNodeWithEdge("Agosto/2026 - Preparação para o lançamento", roadmapId, 500, -200, 0);
    
    const agostoChildren = [
        "Definição do ICP (perfil ideal de cliente).",
        "Estruturação da base de prospecção.",
        "Criação do funil comercial.",
        "Elaboração do roteiro de demonstração.",
        "Produção dos vídeos de treinamento.",
        "Definição dos planos e precificação.",
        "Organização da planilha de acompanhamento comercial."
    ];
    
    agostoChildren.forEach((text, i) => {
        createNodeWithEdge(text, agostoId, 800, -300 + (i * 30), i);
    });
    
    // 2. Add Riscos and its children to Comercial - Alessandro
    const riscosId = createNodeWithEdge("Riscos Previstos e Plano de Mitigação", rootAlessandroId, 250, 400, 5);
    
    const riscosChildren = [
        "1. Baixa Conversão na Prospecção",
        "2. Baixo Agendamento de Demonstrações",
        "3. Baixa Conversão do Período de Teste",
        "4. Alto Volume de Suporte",
        "5. Lentidão na Migração dos Dados",
        "6. Churn (Cancelamento de Clientes)",
        "7. Desenvolvimento Não Acompanhar a Demanda",
        "8. Falta de Indicadores para Tomada de Decisão"
    ];
    
    riscosChildren.forEach((text, i) => {
        createNodeWithEdge(text, riscosId, 500, 300 + (i * 30), i);
    });

    // Insert to DB
    const { error: errNodes } = await supabase.from('nodes').insert(newNodes);
    if (errNodes) console.error("Error inserting nodes:", errNodes);
    else console.log(`Inserted ${newNodes.length} nodes successfully.`);

    const { error: errEdges } = await supabase.from('edges').insert(newEdges);
    if (errEdges) console.error("Error inserting edges:", errEdges);
    else console.log(`Inserted ${newEdges.length} edges successfully.`);
}

run();
