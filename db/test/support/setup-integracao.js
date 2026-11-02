// Roda antes de cada spec de integração, antes do primeiro import de @orleans-em-dados/db.
import { garantirBancoDescartavel } from './banco.js';

garantirBancoDescartavel(process.env.DATABASE_URL);
