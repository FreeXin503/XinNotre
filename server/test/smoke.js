const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';
const TEST_USER = `smoke_${Date.now()}`;
const TEST_PASS = 'SmokeTest123!';

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`\u2705 ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`\u274c ${name}: ${detail}`);
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log(`\u23f3 冒烟测试开始 | BASE_URL=${BASE_URL} | 测试用户: ${TEST_USER}\n`);

  let token = '';
  let noteId = '';
  let tagId = '';
  let kbId = '';

  // 测试 1: 健康检查
  try {
    const { status, data } = await api('GET', '/health');
    if (status === 200 && data.status === 'ok') ok('健康检查');
    else fail('健康检查', `status=${status} body=${JSON.stringify(data)}`);
  } catch (e) { fail('健康检查', e.message); }

  // 测试 2: 用户注册
  try {
    const { status, data } = await api('POST', '/auth/register', { username: TEST_USER, password: TEST_PASS });
    if (status === 201 && data.success) ok('用户注册');
    else fail('用户注册', `status=${status} body=${JSON.stringify(data)}`);
  } catch (e) { fail('用户注册', e.message); }

  // 测试 3: 用户登录
  try {
    const { status, data } = await api('POST', '/auth/login', { username: TEST_USER, password: TEST_PASS });
    if (status === 200 && data.success && data.data?.token) {
      ok('用户登录');
      token = data.data.token;
    } else fail('用户登录', `status=${status} gotToken=${!!data.data?.token}`);
  } catch (e) { fail('用户登录', e.message); }

  if (!token) {
    console.log('\n\u26a0\ufe0f 登录失败，跳过后续需认证的测试');
  } else {
    // 测试 4a: 创建便签
    try {
      const { status, data } = await api('POST', '/notes', { title: '冒烟测试便签', content: '测试内容', category: '测试' }, token);
      if (data.success && data.data?.id) {
        ok('创建便签');
        noteId = data.data.id;
      } else fail('创建便签', JSON.stringify(data));
    } catch (e) { fail('创建便签', e.message); }

    // 测试 4b: 便签列表
    try {
      const { status, data } = await api('GET', '/notes', null, token);
      if (status === 200 && data.success && Array.isArray(data.data?.items)) ok('便签列表');
      else fail('便签列表', JSON.stringify(data).slice(0, 100));
    } catch (e) { fail('便签列表', e.message); }

    // 测试 4c: 便签详情
    if (noteId) {
      try {
        const { status, data } = await api('GET', `/notes/${noteId}`, null, token);
        if (status === 200 && data.success) ok('便签详情');
        else fail('便签详情', JSON.stringify(data));
      } catch (e) { fail('便签详情', e.message); }

      // 测试 4d: 更新便签
      try {
        const { status, data } = await api('PUT', `/notes/${noteId}`, { title: '冒烟测试便签(已更新)' }, token);
        if (status === 200 && data.success) ok('更新便签');
        else fail('更新便签', JSON.stringify(data));
      } catch (e) { fail('更新便签', e.message); }

      // 测试 4e: 删除便签
      try {
        const { status, data } = await api('DELETE', `/notes/${noteId}`, null, token);
        if (status === 200 && data.success) ok('删除便签');
        else fail('删除便签', JSON.stringify(data));
      } catch (e) { fail('删除便签', e.message); }
    }

    // 测试 5a: 创建标签
    try {
      const { status, data } = await api('POST', '/tags', { name: '冒烟标签', color: '#ff6b6b' }, token);
      if (data.success && data.data?.id) {
        ok('创建标签');
        tagId = data.data.id;
      } else fail('创建标签', JSON.stringify(data));
    } catch (e) { fail('创建标签', e.message); }

    // 测试 5b: 标签列表
    try {
      const { status, data } = await api('GET', '/tags', null, token);
      if (status === 200 && Array.isArray(data.data)) ok('标签列表');
      else fail('标签列表', JSON.stringify(data));
    } catch (e) { fail('标签列表', e.message); }

    // 测试 6a: 创建知识库
    try {
      const { status, data } = await api('POST', '/knowledge-bases', { name: '冒烟知识库', description: '测试' }, token);
      if (data.success && data.data?.id) {
        ok('创建知识库');
        kbId = data.data.id;
      } else fail('创建知识库', JSON.stringify(data));
    } catch (e) { fail('创建知识库', e.message); }

    // 测试 6b: 知识库列表
    try {
      const { status, data } = await api('GET', '/knowledge-bases', null, token);
      if (status === 200 && Array.isArray(data.data)) ok('知识库列表');
      else fail('知识库列表', JSON.stringify(data));
    } catch (e) { fail('知识库列表', e.message); }

    // 测试 7: 清理测试数据
    if (kbId) {
      try {
        await api('DELETE', `/knowledge-bases/${kbId}`, null, token);
        ok('清理知识库');
      } catch (e) { fail('清理知识库', e.message); }
    }
    if (tagId) {
      try {
        await api('DELETE', `/tags/${tagId}`, null, token);
        ok('清理标签');
      } catch (e) { fail('清理标签', e.message); }
    }
  }

  console.log(`\n===== \u6d4b\u8bd5\u7ed3\u679c =====`);
  console.log(`\u901a\u8fc7: ${passed}  \u5931\u8d25: ${failed}  \u603b\u8ba1: ${passed + failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
