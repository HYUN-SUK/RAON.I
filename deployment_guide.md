# 🌱 초보자를 위한 깃허브(GitHub) 배포 가이드

현재 고객님의 PC에는 코드가 저장되어 있지만(`git commit` 완료), 이 코드를 인터넷 저장소(GitHub)로 보내는 연결 고리(`remote`)가 아직 설정되지 않은 상태입니다.

아래 절차를 천천히 따라해 주세요.

---

## 1단계: 깃허브에 저장소 만들기
1. 웹 브라우저에서 [GitHub.com](https://github.com)에 로그인합니다.
2. 우측 상단의 `+` 아이콘을 누르고 **New repository**를 클릭합니다.
3. **Repository name**에 `raon-app` (또는 원하시는 이름)을 입력합니다.
4. **Public** (공개) 또는 **Private** (비공개) 중 하나를 선택합니다.
   - *실제 서비스라면 Private을 추천하지만, 무료 배포를 위해 Public으로 하셔도 됩니다.*
5. **Create repository** 버튼을 클릭합니다.

## 2단계: 주소 복사하기
1. 저장소가 생성되면 화면에 여러 명령어가 보입니다.
2. **"…or push an existing repository from the command line"** 섹션을 찾으세요.
3. 그 아래에 있는 주소를 복사해야 합니다. 보통 이런 형태입니다:
   - `https://github.com/사용자명/raon-app.git`
   - 화면의 📋(복사 아이콘)을 누르면 주소가 복사됩니다.

## 3단계: 내 PC와 연결하기 (터미널 명령어)
이제 고객님의 터미널(이 채팅창이 열려있는 곳)에 명령어를 입력해야 합니다.

**명령어 1: 원격 저장소 추가**
(아래 주소는 예시입니다. 복사한 본인의 주소를 사용하세요!)
```bash
git remote add origin https://github.com/YOUR_USERNAME/raon-app.git
```

**명령어 2: 연결 확인**
제대로 연결되었는지 확인합니다.
```bash
git remote -v
```
*(결과로 주소가 출력되면 성공입니다)*

## 4단계: 코드 올리기 (Push)
이제 내 PC의 코드를 깃허브로 쏘아 올립니다!
```bash
git push -u origin master
```
- 만약 로그인 창이 뜨면, 깃허브 아이디/비밀번호를 입력하거나 브라우저 인증을 완료해 주세요.
- 완료되면 "Branch master set up to track remote branch..." 같은 메시지가 나옵니다.

---

## 🚀 배포 (Vercel)
코드가 깃허브에 올라갔다면, 이제 서버를 띄울 차례입니다.

1. [Vercel.com](https://vercel.com)에 로그인합니다.
2. **Add New...** > **Project**를 클릭합니다.
3. **Import Git Repository**에서 방금 올린 `raon-app`을 찾아 **Import**를 누릅니다.
4. **Environment Variables** (환경 변수) 탭을 열고 아래 값을 추가합니다:
   - `SUPABASE_SERVICE_ROLE_KEY`: (가지고 계신 키 값)
   - `CRON_SECRET`: (설정한 비밀 키 값)
5. **Deploy** 버튼을 누르면 끝! 약 1~2분 뒤에 사이트가 생성됩니다.

---
**💡 팁:**
한 번만 이렇게 연결해두면, 다음부터는 `git push origin master` 명령어 하나로 수정 사항을 쉽게 반영할 수 있습니다.
