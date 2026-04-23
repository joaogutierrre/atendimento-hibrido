import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = (pwd: string) => bcrypt.hash(pwd, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Clínicas',
      slug: 'acme',
      agentConfig: {
        create: {
          systemPrompt:
            'Você é um atendente virtual da Acme Clínicas. Seja cordial, objetivo e escalone ao humano quando necessário.',
          tone: 'professional',
          escalateOnWords: ['humano', 'atendente', 'cancelar', 'reclamação'],
          offHoursMessage: 'Estamos fora do horário de atendimento. Retornaremos em breve.',
          workingHoursStart: 8,
          workingHoursEnd: 18,
        },
      },
      branches: {
        create: [
          { name: 'Unidade Centro', address: 'Rua das Flores, 100' },
          { name: 'Unidade Norte', address: 'Av. Norte, 500' },
        ],
      },
    },
    include: { branches: true },
  });

  await prisma.user.upsert({
    where: { email: 'admin@acme.test' },
    update: { name: 'Administrador Acme' },
    create: {
      tenantId: tenant.id,
      email: 'admin@acme.test',
      name: 'Administrador Acme',
      password: await hash('admin123'),
      role: 'ADMIN',
      branches: {
        create: tenant.branches.map((b) => ({ branchId: b.id })),
      },
    },
  });

  await prisma.user.upsert({
    where: { email: 'agent@acme.test' },
    update: { name: 'Atendente Acme' },
    create: {
      tenantId: tenant.id,
      email: 'agent@acme.test',
      name: 'Atendente Acme',
      password: await hash('agent123'),
      role: 'AGENT',
      branches: {
        create: [{ branchId: tenant.branches[0]!.id }],
      },
    },
  });

  // Segundo tenant para validar isolamento multi-tenant
  const other = await prisma.tenant.upsert({
    where: { slug: 'beta' },
    update: {},
    create: {
      name: 'Beta Clínicas',
      slug: 'beta',
      branches: { create: [{ name: 'Unidade Única' }] },
    },
    include: { branches: true },
  });

  await prisma.user.upsert({
    where: { email: 'admin@beta.test' },
    update: { name: 'Administrador Beta' },
    create: {
      tenantId: other.id,
      email: 'admin@beta.test',
      name: 'Administrador Beta',
      password: await hash('admin123'),
      role: 'ADMIN',
      branches: { create: [{ branchId: other.branches[0]!.id }] },
    },
  });

  console.log('✓ Seed concluído: tenants acme + beta com ADMIN e AGENT');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
