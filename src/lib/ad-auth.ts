import ldap from 'ldapjs';
import type { Role } from './session';

/**
 * Autenticação via Active Directory (LDAP) — mesmo conceito usado no Indicadores-RH
 * (github.com/tuliodutra27/Indicadores-RH, web/app/auth.py), portado pra Node/TypeScript.
 *
 * Diferença: lá era um grupo só (acesso sim/não). Aqui são dois grupos — admin (edita) e
 * operador (só visualiza). Quem estiver nos dois vira admin (mais permissivo vence).
 *
 * Limitação conhecida (igual ao Indicadores-RH): só olha o `memberOf` direto do usuário —
 * não resolve grupos aninhados (grupo dentro de grupo).
 */

export interface AdAuthResult {
  ok: boolean;
  /** Nome de exibição (displayName do AD) quando ok=true; mensagem de erro quando ok=false. */
  message: string;
  role?: Role;
}

function buildLdapUrl(): string {
  const rawServer = process.env.AD_SERVER || 'ldap://seu-servidor-ad';
  const port = process.env.AD_PORT || '389';
  const useSsl = (process.env.AD_USE_SSL || 'false').toLowerCase() === 'true';
  const host = rawServer.replace(/^ldaps?:\/\//, '');
  return `${useSsl ? 'ldaps' : 'ldap'}://${host}:${port}`;
}

/** Extrai só o CN de um valor de grupo, aceitando nome puro, "CN=nome" ou DN completo. */
function normalizeGroupName(raw: string): string {
  let value = raw.trim();
  if (value.includes(',')) {
    const [first] = value.split(',');
    value = (first ?? value).trim();
  }
  if (value.toUpperCase().startsWith('CN=')) value = value.slice(3);
  return value.toUpperCase();
}

function parseAllowedGroups(envValue: string | undefined): string[] {
  return (envValue || '')
    .split(';')
    .map((g) => g.trim())
    .filter(Boolean)
    .map(normalizeGroupName);
}

// Tolerante ao formato exato do SearchEntry — a forma como o ldapjs expõe os atributos mudou
// entre versões (array `.attributes` com {type, values} vs. um `.object`/`.pojo` já achatado).
// Não consegui testar isso contra um AD de verdade nesta sessão — se o login funcionar mas vier
// sem nome de exibição ou sem grupo, é o primeiro lugar a olhar.
function getAttributeValues(entry: unknown, attributeName: string): string[] {
  const e = entry as {
    attributes?: Array<{ type?: string; values?: unknown[] }>;
    pojo?: { attributes?: Array<{ type?: string; values?: unknown[] }> };
    object?: Record<string, unknown>;
  };

  const attrList = e.attributes ?? e.pojo?.attributes;
  if (attrList) {
    const attr = attrList.find((a) => a.type?.toLowerCase() === attributeName.toLowerCase());
    if (attr?.values) {
      return attr.values.map((v) => (Buffer.isBuffer(v) ? v.toString('utf-8') : String(v)));
    }
  }

  const raw = e.object?.[attributeName];
  if (raw == null) return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

function resolveRole(memberOf: string[]): Role | null {
  const memberOfUpper = memberOf.map((m) => m.toUpperCase());
  const adminGroups = parseAllowedGroups(process.env.AD_ADMIN_GROUP_CN);
  const operatorGroups = parseAllowedGroups(process.env.AD_OPERATOR_GROUP_CN);

  const isInAnyGroup = (groups: string[]) =>
    groups.some((group) => memberOfUpper.some((dn) => dn.includes(`CN=${group},`) || dn.startsWith(`CN=${group},`)));

  if (isInAnyGroup(adminGroups)) return 'admin';
  if (isInAnyGroup(operatorGroups)) return 'operator';
  return null;
}

function devModeUsers(): Record<string, { password: string; role: Role }> {
  try {
    const raw = JSON.parse(process.env.DEV_USERS || '{}') as Record<string, string>;
    const parsed: Record<string, { password: string; role: Role }> = {};
    for (const [username, value] of Object.entries(raw)) {
      // Formato: "senha:role" — ex: "senha123:admin". Sem ":role", assume "operator".
      const [password, role] = value.split(':');
      parsed[username] = { password: password ?? '', role: role === 'admin' ? 'admin' : 'operator' };
    }
    return parsed;
  } catch {
    return {};
  }
}

export async function authenticateAgainstAd(username: string, password: string): Promise<AdAuthResult> {
  const devMode = (process.env.DEV_MODE || 'false').toLowerCase() === 'true';

  // ── Modo desenvolvimento (sem AD) — NUNCA habilitar em produção ──────────────────────────
  if (devMode) {
    const users = devModeUsers();
    if (Object.keys(users).length > 0) {
      const user = users[username];
      if (user && user.password === password) {
        return { ok: true, message: `${username} (DEV)`, role: user.role };
      }
      return { ok: false, message: 'Usuário ou senha incorretos.' };
    }
    // Sem DEV_USERS definido → aceita qualquer credencial como admin (só pra testar a UI).
    return { ok: true, message: `${username} (DEV)`, role: 'admin' };
  }

  // ── Autenticação real via LDAP/AD ─────────────────────────────────────────────────────────
  const domain = process.env.AD_DOMAIN || 'aliseo.local';
  const baseDn = process.env.AD_BASE_DN || 'DC=aliseo,DC=local';
  const userUpn = `${username}@${domain}`;

  const client = ldap.createClient({
    url: buildLdapUrl(),
    connectTimeout: 8000,
    timeout: 10000,
  });

  const cleanup = () => {
    try {
      client.unbind();
    } catch {
      // ignora erro ao encerrar a conexão
    }
  };

  try {
    await new Promise<void>((resolve, reject) => {
      client.on('error', reject);
      client.bind(userUpn, password, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const entry = await new Promise<unknown | null>((resolve, reject) => {
      client.search(
        baseDn,
        {
          filter: `(&(objectClass=user)(sAMAccountName=${username}))`,
          scope: 'sub',
          attributes: ['displayName', 'memberOf', 'sAMAccountName'],
        },
        (err, res) => {
          if (err) return reject(err);
          let found: unknown | null = null;
          res.on('searchEntry', (searchEntry) => {
            found = searchEntry;
          });
          res.on('error', reject);
          res.on('end', () => resolve(found));
        },
      );
    });

    cleanup();

    if (!entry) {
      return { ok: false, message: 'Usuário não encontrado no Active Directory.' };
    }

    const displayNameValues = getAttributeValues(entry, 'displayName');
    const displayName = displayNameValues[0] || username;
    const memberOf = getAttributeValues(entry, 'memberOf');

    const role = resolveRole(memberOf);
    if (!role) {
      const adminGroups = parseAllowedGroups(process.env.AD_ADMIN_GROUP_CN);
      const operatorGroups = parseAllowedGroups(process.env.AD_OPERATOR_GROUP_CN);
      const nomes = [...adminGroups, ...operatorGroups].join(', ');
      return {
        ok: false,
        message: `Acesso negado. Apenas usuários dos grupos [${nomes}] têm permissão para acessar este sistema.`,
      };
    }

    return { ok: true, message: displayName, role };
  } catch (err) {
    cleanup();
    const error = err as { code?: string; message?: string };
    if (error?.code === 'InvalidCredentialsError' || error?.message?.includes('InvalidCredentials')) {
      return { ok: false, message: 'Usuário ou senha incorretos.' };
    }
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return {
        ok: false,
        message: `Não foi possível conectar ao servidor AD (${process.env.AD_SERVER}). Verifique a configuração de rede.`,
      };
    }
    return { ok: false, message: `Erro de autenticação LDAP: ${error?.message || 'erro desconhecido'}` };
  }
}
