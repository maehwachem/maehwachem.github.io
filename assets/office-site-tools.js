(() => {
  'use strict';
  const officeUrl = 'https://kong-studio.kjeung.chatgpt.site/';
  let lifecycle;
  const emptyInput = {type: 'object', properties: {}, additionalProperties: false};
  function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) {
      throw new Error('이 도구에는 추가 입력이 필요하지 않아요. 빈 객체로 요청해 주세요.');
    }
  }
  async function register() {
    lifecycle?.abort();
    const registry = document.modelContext;
    if (typeof registry?.registerTool !== 'function') return;
    const current = new AbortController();
    lifecycle = current;
    const tools = [
      {
        name: 'kong_office_connection',
        description: '포트폴리오에 연결된 비공개 콩 연구소 주소와 이용 방법을 읽습니다. 이 공개 페이지는 개인 업무 기록을 읽거나 저장하지 않습니다.',
        inputSchema: emptyInput,
        annotations: {readOnlyHint: true},
        execute(input) {
          validate(input);
          return {
            name: '콩 연구소', url: officeUrl, requiresLogin: true,
            instructions: 'open_kong_office로 연구소를 최상위 페이지로 열고 기존 계정으로 로그인하세요. 열린 연구소의 사이트 도구를 다시 확인한 뒤 office_guide, list_tasks, get_task, create_task, update_task, read_attachment를 사용하세요. 업무 실행은 사용자가 요청한 범위에서 대화의 AI가 수행합니다.',
          };
        },
      },
      {
        name: 'open_kong_office',
        description: '포트폴리오의 콩 연구소 메뉴를 눌러 같은 탭에서 비공개 사무실로 이동합니다. 아직 업무를 생성하거나 실행하지 않습니다. 이동 후 연구소의 사이트 도구를 다시 확인하세요.',
        inputSchema: emptyInput,
        annotations: {readOnlyHint: false},
        execute(input) {
          validate(input);
          const link = document.querySelector('a.kje-office-link');
          if (!link || link.href !== officeUrl) throw new Error('연구소 메뉴 주소를 확인해 주세요.');
          link.click();
          return {opening: officeUrl, taskStarted: false};
        },
      },
    ];
    try {
      for (const tool of tools) {
        if (current.signal.aborted) return;
        await registry.registerTool(tool, {signal: current.signal});
      }
    } catch {
      current.abort(); // Normal links continue to work if tool registration fails.
    }
  }
  window.addEventListener('pagehide', () => lifecycle?.abort());
  window.addEventListener('pageshow', event => { if (event.persisted) void register(); });
  void register();
})();
