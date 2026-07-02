
import pg from 'pg';
const { Client } = pg;

const insertCompanies = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('35.663.473/0001-53', 'J. S. VILLAS BOAS LTDA', '356634', 'green', false, 'ecf13cf3-851e-43c8-a6a3-b11d4c139be5') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('36.662.174/0001-67', 'VM INSTALACOES ELETRICAS LTDA', '366621', 'green', false, '71fc3a02-40ce-4e32-bc65-5b010ddbc9d6') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('53.511.388/0001-51', 'M SODRE EVOLUCAO FITNESS LTDA', '535113', 'green', false, 'b0293191-e015-434b-bb20-ec25202e1f3a') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('53.351.769/0001-10', 'REABILITY - NUCLEO DE DESENVOLVIMENTO NEUROLOGICO LTDA', '533517', 'green', false, 'af1355f8-f645-4aa2-a216-aaf9775e11b2') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('52.286.724/0001-47', 'JN MARKETING DIRETO LTDA', '522867', 'green', false, '69dcb2ae-9b75-4e57-802e-fd550b8eec65') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('17.072.223/0001-67', 'SONS MAGICOS LTDA', '170722', 'green', false, 'dca5e1bd-a187-4db3-b8c8-50ec5f4462e7') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('53.371.805/0001-08', 'ANALU VALLADARES VASCONCELOS LTDA', '533718', 'green', false, '8dcc95be-0fec-4ee6-ad19-29396d056102') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('53.780.785/0001-29', 'DANIELE D''PAULA FISIOTERAPIA LTDA', '537807', 'green', false, 'bb1cbcad-b5da-48f5-a1f9-38a4aa9b0c19') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('36.405.338/0001-70', 'RC DOS SANTOS COMERCIO DE PECAS E SERVICOS LTDA', '364053', 'green', false, '3884f175-0302-4f05-be39-85ab31d020fe') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('57.268.920/0001-02', 'GILIANE SANTOS PACHECO', '572689', 'green', false, '98327ff8-4949-4fd2-9a72-c39cb350ba8c') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('10.417.713/0001-09', 'VIVER MELHOR ACADEMIA E COMERCIO DE PRODUTOS NATURAIS LTDA', '104177', 'green', false, '31187ee0-97dc-42d4-8657-e660e62c3ad5') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('58.560.180/0001-46', 'A GOIS CARVALHO MINIMERCADO', '585601', 'green', false, '168a50bb-064c-418d-94c1-0a7d1d3ec29f') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('03.151.493/0001-59', 'FERRAZ & ALMADA LTDA', '031514', 'green', false, '76700551-b6bb-4a0b-88a9-d9505a9d2694') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('35.566.952/0001-51', 'CONDOMINIO FAZENDA PEDRA DO LAGO', '355669', 'green', false, 'ef5b547b-0d34-4fbc-84b8-265458829fe7') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('27.412.432/0001-66', 'JF METAIS INDUSTRIA COMERCIO E SERVICOS LTDA', '274124', 'green', false, '5e746e10-1656-4131-8dc3-1ef837b76568') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('47.694.356/0001-36', 'ROBERTA SILVA SANDES NASCIMENTO 03252435578', '476943', 'green', false, 'eca82b0c-1bdd-4742-a823-7c5c2c54973a') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('57.464.749/0001-07', 'JL LOCACOES COMERCIO E SERVICOS LTDA', '574647', 'green', false, '0dd2ce40-ef06-4621-a60e-9ce2eb19c318') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('13.123.070/0001-89', 'BENEDITO FERREIRA COSTA', '131230', 'green', false, '5588fd90-79f1-46a6-9ddf-0dc0e5499cc8') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('48.171.544/0001-42', 'VSC DISTRIBUIDORA DE BEBIDAS LTDA', '481715', 'green', false, '86e5f8e7-ecc0-47ef-ae20-4cf34d37811e') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('33.569.600/0001-24', 'VIDRACARIA CIDADE JARDIM LTDA', '335696', 'green', false, 'efa4a7c9-1f23-4682-af38-7aa2af82a9ba') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('63.555.615/0001-02', 'ANTONIO EDSON DA COSTA NASCIMENTO', '635556', 'green', false, 'eb493cee-dde7-428c-9b0d-09fccc7c5da0') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('25.044.857/0001-34', 'JOAO RICARDO BRANDAO COSTA', '250448', 'green', false, '6bc3ea96-e865-4999-b8de-79f904d7a8d2') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('563.685.345-91', 'JOAO DO NASCIMENTO', '563685', 'green', false, '6bb9e1b0-eb56-43c0-bb21-78e521824199') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('37.386.701/0001-10', 'D C VIANA MINI-MERCADO', '373867', 'green', false, '4187f7b9-69da-405a-bdf1-90aa04eb927d') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('39.573.189/0001-47', 'ANTONIO CARLOS GONCALVES DOS SANTOS ENGENHARIA', '395731', 'green', false, '88dcb521-4b5a-4e8a-87b3-0fe89472cd2a') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('55.674.193/0001-58', 'CENTRO DE PRODUCAO DE OVOS RANCHO NIPI E MJ OVOS CAIPIRA LTDA', '556741', 'green', false, 'b78cf5e1-0ed4-4dbf-bd10-4ca119268015') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('58.443.087/0001-51', 'CENTRO DE TREINAMENTO GABRIEL LEDO LTDA', '584430', 'green', false, '09061828-da39-4c71-b4d0-fdcd114e40c5') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('47.231.328/0001-82', 'MELHOR DO BRASIL LTDA', '472313', 'green', false, '4c179bd6-9de0-4212-8bbb-f5dd664d871e') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('65.120.809/0001-00', 'GRASIELLE NASCIMENTO DE OLIVEIRA LTDA', '651208', 'green', false, '9fe8e3eb-96b3-4ae6-84c1-e8c0499dcc15') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('64.717.579/0001-90', 'MARIANA DE OLIVEIRA FERRAZ QUEIROZ', '647175', 'green', false, '8c169ef5-f953-4983-bb73-09114c7421e8') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('65.215.346/0001-52', 'RODNEI SANTOS DE OLIVEIRA', '652153', 'green', false, 'e1a8d81d-9e8b-414e-83f2-fa8faaf5bc96') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('66.047.950/0001-80', 'JOALISSON OLIVEIRA MENEZES', '660479', 'green', false, '2daea837-7462-4d5e-aefd-978ccb95b759') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('08.570.758/0001-77', 'PE DE ARTE CULTURA E EDUCACAO - PACE', '085707', 'green', false, '2c5461d0-c195-43df-b0f5-3b65cfd393f1') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('59.246.639/0001-02', 'LUANA AMORIM SANTOS FONOAUDIOLOGIA', '592466', 'green', false, 'e71328c0-b7fb-404a-b79d-acf2cd74076') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('66.188.288/0001-88', 'CASSIO CORREIA DE QUEIROZ', '661882', 'green', false, '50cc64bc-2a8a-4cde-bb55-8bfcb84dce69') ON CONFLICT (cnpj) DO NOTHING;");
    await client.query("INSERT INTO clients (cnpj, name, password_hash, regularity_status, first_access_done, integration_hash) VALUES ('67.228.756/0001-63', 'RAFAEL SILVA SANDES NASCIMENTO', '672287', 'green', false, '1e3818c9-8926-4de9-b79e-39484994ae38') ON CONFLICT (cnpj) DO NOTHING;");

    console.log('Empresas adicionadas com sucesso!');
  } catch (error) {
    console.error('Erro ao adicionar empresas:', error);
  } finally {
    await client.end();
  }
};

insertCompanies();
