import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const hash = (value, salt = 0) => [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0) + salt) >>> 0, 7 + salt);
function reserve(login, used) {
    const spacing = 15;
    for (let attempt = 0; attempt < 6000; attempt++) {
        const xSeed = hash(login, attempt * 17 + 11);
        const zSeed = hash(login, attempt * 29 + 23);
        const radius = 1 + (xSeed % 6);
        const angle = (zSeed % 3600) / 3600 * Math.PI * 2;
        const x = Math.round((Math.cos(angle) * radius + ((xSeed >>> 8) % 3 - 1) * .28) * spacing);
        const z = Math.round((Math.sin(angle) * radius + ((zSeed >>> 12) % 3 - 1) * .28) * spacing);
        if (used.every(([usedX, usedZ]) => Math.hypot(usedX - x, usedZ - z) >= 12)) {
            used.push([x, z]);
            return [x, z];
        }
    }
    throw new Error(`Sem posição para ${login}`);
}
async function run() {
    const ports = await prisma.port.findMany({ include: { developer: true }, orderBy: { developer: { githubLogin: 'asc' } } });
    const used = [];
    for (const port of ports) {
        const [worldX, worldZ] = reserve(port.developer.githubLogin, used);
        await prisma.port.update({ where: { id: port.id }, data: { worldX, worldZ } });
    }
    console.log(`✓ ${ports.length} portos foram distribuídos novamente. Nenhum perfil ou repositório foi removido.`);
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
