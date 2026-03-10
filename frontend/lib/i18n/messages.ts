import type { Locale } from "./config";

export type MessageKey =
  | "common.app_name"
  | "common.request_failed"
  | "common.error_occurred"
  | "common.error_email_registered"
  | "common.error_invalid_credentials"
  | "common.error_invite_code_not_found"
  | "common.error_invite_code_self"
  | "common.loading"
  | "common.loading_dashboard"
  | "common.retry"
  | "common.view_details"
  | "common.redirecting"
  | "common.cancel"
  | "common.refresh"
  | "common.logout"
  | "common.language"
  | "common.close"
  | "common.confirm"
  | "common.email"
  | "common.password"
  | "common.display_name"
  | "common.required_password_hint"
  | "common.role_preference"
  | "common.select_option"
  | "common.no_data"
  | "common.nothing_to_show"
  | "error.generic_title"
  | "error.generic_description"
  | "error.page_crashed_title"
  | "error.page_crashed_description"
  | "login.header_tagline"
  | "login.login_title"
  | "login.register_title"
  | "login.login_description"
  | "login.register_description"
  | "login.submit"
  | "login.submitting"
  | "login.create_account"
  | "login.creating_account"
  | "login.no_account"
  | "login.register_link"
  | "login.have_account"
  | "login.back_to_login"
  | "login.email_placeholder"
  | "login.password_placeholder"
  | "login.display_name_placeholder"
  | "login.role_placeholder"
  | "login.validation.email_required"
  | "login.validation.email_invalid"
  | "login.validation.password_required"
  | "login.validation.password_min"
  | "login.validation.display_name_required"
  | "role.owner"
  | "role.puppy"
  | "dashboard.title"
  | "dashboard.unauthenticated_title"
  | "dashboard.unauthenticated_description"
  | "dashboard.owner_view"
  | "dashboard.puppy_view"
  | "dashboard.status"
  | "dashboard.intimacy"
  | "dashboard.invite_code"
  | "dashboard.no_relationship_title"
  | "dashboard.no_relationship_description"
  | "dashboard.bind_by_invite"
  | "dashboard.open_tasks"
  | "dashboard.submitted_tasks"
  | "dashboard.approved_tasks"
  | "dashboard.wallet"
  | "dashboard.coins"
  | "dashboard.create_task"
  | "dashboard.task_list_title"
  | "dashboard.empty_owner"
  | "dashboard.empty_puppy"
  | "dashboard.create_task_modal"
  | "dashboard.task_title"
  | "dashboard.task_title_placeholder"
  | "dashboard.task_description"
  | "dashboard.task_description_placeholder"
  | "dashboard.reward_coins"
  | "dashboard.deadline"
  | "dashboard.no_deadline"
  | "dashboard.clear_deadline"
  | "dashboard.task_submission_requirement"
  | "dashboard.task_submission_type.note"
  | "dashboard.task_submission_type.image"
  | "dashboard.task_submission_type.video"
  | "dashboard.submit_task_modal"
  | "dashboard.task_submission_note"
  | "dashboard.task_submission_note_placeholder"
  | "dashboard.task_submission_media_url"
  | "dashboard.task_submission_media_url_placeholder"
  | "dashboard.task_submission_pick_image"
  | "dashboard.task_submission_pick_video"
  | "dashboard.task_submission_no_file"
  | "dashboard.task_submission_image_hint"
  | "dashboard.task_submission_video_hint"
  | "dashboard.task_submission_link"
  | "dashboard.bind_relationship_modal"
  | "dashboard.invite_code_placeholder"
  | "dashboard.binding"
  | "dashboard.binding_done"
  | "dashboard.create_task_done"
  | "dashboard.submission_note"
  | "dashboard.reject_reason"
  | "dashboard.task_submitted"
  | "dashboard.task_approved"
  | "dashboard.task_rejected"
  | "dashboard.only_owner_can_create"
  | "dashboard.task_status.open"
  | "dashboard.task_status.submitted"
  | "dashboard.task_status.approved"
  | "dashboard.task_status.rejected"
  | "dashboard.task_status.expired"
  | "dashboard.relationship_status.active"
  | "dashboard.relationship_status.pending"
  | "dashboard.relationship_status.paused"
  | "dashboard.relationship_status.ended"
  | "bind.title"
  | "bind.description"
  | "bind.my_invite_code"
  | "bind.copy_code"
  | "bind.copy_done"
  | "bind.enter_owner_code"
  | "bind.enter_counterpart_code"
  | "bind.counterpart_code_hint"
  | "bind.skip_to_dashboard"
  | "bind.owner_waiting_hint"
  | "bind.puppy_waiting_hint"
  | "bind.account_summary"
  | "bind.open_dashboard"
  | "bind.source_register"
  | "bind.source_login"
  | "bind.tab_match"
  | "bind.tab_invite"
  | "bind.match_intro_label"
  | "bind.match_intro_placeholder"
  | "bind.match_create_post"
  | "bind.match_pick_image"
  | "bind.match_close_post"
  | "bind.match_posts_title"
  | "bind.match_send_request"
  | "bind.match_message_placeholder"
  | "bind.match_inbox_title"
  | "bind.match_sent_title"
  | "bind.match_accept"
  | "bind.match_reject"
  | "bind.match_block"
  | "bind.match_report"
  | "bind.match_pending_count"
  | "bind.match_daily_usage"
  | "bind.match_no_posts"
  | "bind.match_status.pending"
  | "bind.match_status.accepted"
  | "bind.match_status.rejected"
  | "bind.match_status.cancelled"
  | "bind.community_feed"
  | "bind.community_inbox"
  | "bind.community_mine"
  | "bind.community_publish_post"
  | "bind.community_publish_title"
  | "bind.community_publish_hint"
  | "bind.community_feed_empty"
  | "bind.community_inbox_empty"
  | "bind.community_mine_empty"
  | "dashboard.open_match_plaza"
  | "match.error_daily_limit_reached"
  | "match.error_blocked_by_target"
  | "match.error_same_role_forbidden"
  | "match.error_already_paired"
  | "match.error_request_rejected"
  | "dashboard.request_task"
  | "dashboard.task_request_modal"
  | "dashboard.task_request_title"
  | "dashboard.task_request_title_placeholder"
  | "dashboard.task_request_note"
  | "dashboard.task_request_note_placeholder"
  | "dashboard.task_request_sent"
  | "dashboard.task_request_empty_owner"
  | "dashboard.task_request_empty_puppy"
  | "dashboard.task_request_status.pending"
  | "dashboard.task_request_status.fulfilled"
  | "dashboard.task_request_status.rejected"
  | "dashboard.reject_task_request"
  | "dashboard.fulfill_task_request"
  | "dashboard.binding_reminder"
  | "dashboard.binding_skip_active"
  | "dashboard.request_queue_title"
  | "dashboard.my_requests_title"
  | "dashboard.linked_task_label"
  | "dashboard.task_request_preset.training"
  | "dashboard.task_request_preset.discipline"
  | "dashboard.task_request_preset.structured"
  | "dashboard.nav.overview"
  | "dashboard.nav.tasks"
  | "dashboard.nav.requests"
  | "dashboard.nav.profile"
  | "dashboard.section.overview_hint"
  | "dashboard.section.tasks_hint"
  | "dashboard.section.requests_hint"
  | "dashboard.section.profile_hint"
  | "dashboard.reward_rule_hint"
  | "dashboard.submitted_at";

export type Messages = Record<MessageKey, string>;

const enMessages: Messages = {
  "common.app_name": "Puppy",
  "common.request_failed": "Request failed",
  "common.error_occurred": "Something went wrong. Please try again.",
  "common.error_email_registered": "This email is already registered. Please log in or use another email.",
  "common.error_invalid_credentials": "Email or password is incorrect.",
  "common.error_invite_code_not_found": "Invite code not found. Please check and try again.",
  "common.error_invite_code_self": "You cannot use your own invite code.",
  "common.loading": "Loading...",
  "common.loading_dashboard": "Loading dashboard...",
  "common.retry": "Retry",
  "common.view_details": "View details",
  "common.redirecting": "Redirecting...",
  "common.cancel": "Cancel",
  "common.refresh": "Refresh",
  "common.logout": "Log out",
  "common.language": "Language",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.email": "Email",
  "common.password": "Password",
  "common.display_name": "Display name",
  "common.required_password_hint": "At least 8 characters.",
  "common.role_preference": "Role preference",
  "common.select_option": "Select an option",
  "common.no_data": "No data",
  "common.nothing_to_show": "Nothing to show yet.",
  "error.generic_title": "Something went wrong",
  "error.generic_description": "Please try again in a moment.",
  "error.page_crashed_title": "Page crashed",
  "error.page_crashed_description": "Refresh and try again.",
  "login.header_tagline": "Owner and puppy",
  "login.login_title": "Log in to your account",
  "login.register_title": "Create your account",
  "login.login_description": "Enter your email and password to open the dashboard.",
  "login.register_description": "After signup, you will go to binding guidance.",
  "login.submit": "Log in",
  "login.submitting": "Logging in...",
  "login.create_account": "Create account",
  "login.creating_account": "Creating...",
  "login.no_account": "No account yet?",
  "login.register_link": "Sign up",
  "login.have_account": "Already have an account?",
  "login.back_to_login": "Back to login",
  "login.email_placeholder": "your-email@example.com",
  "login.password_placeholder": "Enter your password",
  "login.display_name_placeholder": "Enter your display name",
  "login.role_placeholder": "Choose a role",
  "login.validation.email_required": "Please enter your email.",
  "login.validation.email_invalid": "Email format is invalid.",
  "login.validation.password_required": "Please enter your password.",
  "login.validation.password_min": "Password must be at least 8 characters.",
  "login.validation.display_name_required": "Please enter your display name.",
  "role.owner": "Owner",
  "role.puppy": "Puppy",
  "dashboard.title": "Dashboard",
  "dashboard.unauthenticated_title": "Not logged in",
  "dashboard.unauthenticated_description": "Redirecting to login...",
  "dashboard.owner_view": "Owner view",
  "dashboard.puppy_view": "Puppy view",
  "dashboard.status": "Status",
  "dashboard.intimacy": "Intimacy",
  "dashboard.invite_code": "Invite code",
  "dashboard.no_relationship_title": "No relationship yet",
  "dashboard.no_relationship_description": "Use an invite code to link two accounts before creating tasks.",
  "dashboard.bind_by_invite": "Bind with invite code",
  "dashboard.open_tasks": "Open tasks",
  "dashboard.submitted_tasks": "Submitted tasks",
  "dashboard.approved_tasks": "Approved tasks",
  "dashboard.wallet": "Wallet",
  "dashboard.coins": "coins",
  "dashboard.create_task": "Create new task",
  "dashboard.task_list_title": "Task list",
  "dashboard.empty_owner": "Create the first task to start the loop.",
  "dashboard.empty_puppy": "Wait for the owner to create a task.",
  "dashboard.create_task_modal": "Create task",
  "dashboard.task_title": "Task title",
  "dashboard.task_title_placeholder": "Enter task title",
  "dashboard.task_description": "Task description",
  "dashboard.task_description_placeholder": "Enter task description",
  "dashboard.reward_coins": "Reward coins",
  "dashboard.deadline": "Deadline",
  "dashboard.no_deadline": "No deadline",
  "dashboard.clear_deadline": "Clear deadline",
  "dashboard.task_submission_requirement": "Required proof",
  "dashboard.task_submission_type.note": "Text note",
  "dashboard.task_submission_type.image": "Image",
  "dashboard.task_submission_type.video": "Video",
  "dashboard.submit_task_modal": "Submit task",
  "dashboard.task_submission_note": "Submission note",
  "dashboard.task_submission_note_placeholder": "Optional note for your owner",
  "dashboard.task_submission_media_url": "Upload file",
  "dashboard.task_submission_media_url_placeholder": "Choose an image or video file",
  "dashboard.task_submission_pick_image": "Choose image",
  "dashboard.task_submission_pick_video": "Choose video",
  "dashboard.task_submission_no_file": "No file selected yet",
  "dashboard.task_submission_image_hint": "Choose from your camera roll, or take a new photo depending on your browser.",
  "dashboard.task_submission_video_hint": "Choose a video file from your phone.",
  "dashboard.task_submission_link": "Open submission",
  "dashboard.bind_relationship_modal": "Bind relationship",
  "dashboard.invite_code_placeholder": "Enter invite code",
  "dashboard.binding": "Binding...",
  "dashboard.binding_done": "Relationship created.",
  "dashboard.create_task_done": "Task created.",
  "dashboard.submission_note": "Submitted from dashboard",
  "dashboard.reject_reason": "Rejected from dashboard",
  "dashboard.task_submitted": "Task submitted.",
  "dashboard.task_approved": "Task approved.",
  "dashboard.task_rejected": "Task rejected.",
  "dashboard.only_owner_can_create": "Only the owner can create tasks.",
  "dashboard.task_status.open": "Open",
  "dashboard.task_status.submitted": "Submitted",
  "dashboard.task_status.approved": "Approved",
  "dashboard.task_status.rejected": "Rejected",
  "dashboard.task_status.expired": "Expired",
  "dashboard.relationship_status.active": "Active",
  "dashboard.relationship_status.pending": "Pending",
  "dashboard.relationship_status.paused": "Paused",
  "dashboard.relationship_status.ended": "Ended",
  "bind.title": "Bind your relationship",
  "bind.description": "See your invite code and connect to the right person without hunting through menus.",
  "bind.my_invite_code": "My invite code",
  "bind.copy_code": "Copy code",
  "bind.copy_done": "Copied",
  "bind.enter_owner_code": "Enter owner's invite code",
  "bind.enter_counterpart_code": "Enter your counterpart's invite code",
  "bind.counterpart_code_hint": "Both owner and puppy can enter the other person's invite code to match.",
  "bind.skip_to_dashboard": "Later, show dashboard first",
  "bind.owner_waiting_hint": "Share your code with a puppy. Once they bind to you, the dashboard will unlock the full loop.",
  "bind.puppy_waiting_hint": "Ask your owner to share their code so you can link up.",
  "bind.account_summary": "Account summary",
  "bind.open_dashboard": "Open dashboard",
  "bind.source_register": "Your account is ready. Start from binding.",
  "bind.source_login": "You are logged in. Finish binding to unlock the full flow.",
  "bind.tab_match": "Match plaza",
  "bind.tab_invite": "Invite code",
  "bind.match_intro_label": "Your match intro",
  "bind.match_intro_placeholder": "Write a short intro so the other side knows who you are.",
  "bind.match_create_post": "Publish in plaza",
  "bind.match_pick_image": "Attach a photo",
  "bind.match_close_post": "Close my post",
  "bind.match_posts_title": "Open match posts",
  "bind.match_send_request": "Send invite",
  "bind.match_message_placeholder": "Optional message",
  "bind.match_inbox_title": "Invites for me",
  "bind.match_sent_title": "Invites I sent",
  "bind.match_accept": "Accept",
  "bind.match_reject": "Reject",
  "bind.match_block": "Block",
  "bind.match_report": "Report",
  "bind.match_pending_count": "Pending invites",
  "bind.match_daily_usage": "Today sent",
  "bind.match_no_posts": "No open posts yet.",
  "bind.match_status.pending": "Pending",
  "bind.match_status.accepted": "Accepted",
  "bind.match_status.rejected": "Rejected",
  "bind.match_status.cancelled": "Cancelled",
  "bind.community_feed": "Feed",
  "bind.community_inbox": "Inbox",
  "bind.community_mine": "Mine",
  "bind.community_publish_post": "Publish post",
  "bind.community_publish_title": "Publish to match plaza",
  "bind.community_publish_hint": "Write a short intro so the right person can find you faster.",
  "bind.community_feed_empty": "No posts yet. Be the first to publish.",
  "bind.community_inbox_empty": "No invites in your inbox yet.",
  "bind.community_mine_empty": "No active post or sent invites yet.",
  "dashboard.open_match_plaza": "Go to match plaza",
  "match.error_daily_limit_reached": "Invite failed: daily limit reached (5/5).",
  "match.error_blocked_by_target": "Invite failed: you are blocked by this user.",
  "match.error_same_role_forbidden": "Invite failed: same-role matching is not allowed.",
  "match.error_already_paired": "Invite failed: this user is already paired.",
  "match.error_request_rejected": "Invite rejected by this user.",
  "dashboard.request_task": "Ask for a task",
  "dashboard.task_request_modal": "Ask for a task",
  "dashboard.task_request_title": "What do you want to ask for?",
  "dashboard.task_request_title_placeholder": "For example: I want a training task",
  "dashboard.task_request_note": "Extra note",
  "dashboard.task_request_note_placeholder": "Optional details for your owner",
  "dashboard.task_request_sent": "Task request sent.",
  "dashboard.task_request_empty_owner": "No pending asks from your puppy right now.",
  "dashboard.task_request_empty_puppy": "No asks sent yet. Ask for one when you want direction.",
  "dashboard.task_request_status.pending": "Pending",
  "dashboard.task_request_status.fulfilled": "Fulfilled",
  "dashboard.task_request_status.rejected": "Rejected",
  "dashboard.reject_task_request": "Reject ask",
  "dashboard.fulfill_task_request": "Set the task",
  "dashboard.binding_reminder": "You skipped binding for now. Core actions stay limited until you connect accounts.",
  "dashboard.binding_skip_active": "Binding is still the next step.",
  "dashboard.request_queue_title": "Puppy asks",
  "dashboard.my_requests_title": "My asks",
  "dashboard.linked_task_label": "Linked task",
  "dashboard.task_request_preset.training": "I want a training task",
  "dashboard.task_request_preset.discipline": "Give me a discipline task",
  "dashboard.task_request_preset.structured": "I want something structured today",
  "dashboard.nav.overview": "Overview",
  "dashboard.nav.tasks": "Tasks",
  "dashboard.nav.requests": "Requests",
  "dashboard.nav.profile": "Profile",
  "dashboard.section.overview_hint": "See the relationship summary, stats, and quick actions.",
  "dashboard.section.tasks_hint": "Review tasks, rewards, and the next action that needs attention.",
  "dashboard.section.requests_hint": "Track asks, replies, and pending request decisions.",
  "dashboard.section.profile_hint": "Check your account identity, role, and session actions.",
  "dashboard.reward_rule_hint": "Approved tasks grant 1 coin to both owner and puppy, up to 5 per day.",
  "dashboard.submitted_at": "Submitted at",
};

const zhCNMessages: Messages = {
  ...enMessages,
  "common.app_name": "Puppy",
  "common.request_failed": "请求失败",
  "common.error_occurred": "出错了，请稍后再试。",
  "common.error_email_registered": "该邮箱已注册，请直接登录或更换邮箱。",
  "common.error_invalid_credentials": "邮箱或密码不正确。",
  "common.error_invite_code_not_found": "邀请码不存在，请检查后重试。",
  "common.error_invite_code_self": "不能使用自己的邀请码。",
  "common.loading": "加载中...",
  "common.loading_dashboard": "正在加载仪表盘...",
  "common.retry": "重试",
  "common.view_details": "查看详情",
  "common.redirecting": "正在跳转...",
  "common.cancel": "取消",
  "common.refresh": "刷新",
  "common.logout": "退出登录",
  "common.language": "语言",
  "common.close": "关闭",
  "common.confirm": "确认",
  "common.email": "邮箱",
  "common.password": "密码",
  "common.display_name": "显示名称",
  "common.required_password_hint": "至少 8 个字符。",
  "common.role_preference": "角色偏好",
  "common.select_option": "请选择",
  "common.no_data": "暂无数据",
  "common.nothing_to_show": "暂时没有内容。",
  "error.generic_title": "出了点问题",
  "error.generic_description": "先缓一缓，稍后再试。",
  "error.page_crashed_title": "页面崩溃了",
  "error.page_crashed_description": "刷新一下，再回来继续。",
  "login.header_tagline": "主人与乖狗的默契",
  "login.login_title": "回来听主人的安排",
  "login.register_title": "建立你的专属归属",
  "login.login_description": "输入邮箱和密码，重新回到只属于你们的节奏里。",
  "login.register_description": "先留下你的信息，接着去建立那条只对彼此开启的连接。",
  "login.submit": "进入关系",
  "login.submitting": "正在回到主人身边...",
  "login.create_account": "建立归属",
  "login.creating_account": "正在替你系上项圈...",
  "login.no_account": "还没留下你的名字？",
  "login.register_link": "现在归属",
  "login.have_account": "已经有归属了？",
  "login.back_to_login": "回到入口",
  "login.email_placeholder": "your-email@example.com",
  "login.password_placeholder": "输入只属于你的暗号",
  "login.display_name_placeholder": "怎么称呼",
  "login.role_placeholder": "选择角色",
  "login.validation.email_required": "请输入邮箱。",
  "login.validation.email_invalid": "邮箱格式无效。",
  "login.validation.password_required": "请输入密码。",
  "login.validation.password_min": "密码至少 8 个字符。",
  "login.validation.display_name_required": "请输入显示名称。",
  "role.owner": "主人",
  "role.puppy": "小狗",
  "dashboard.title": "掌控台",
  "dashboard.unauthenticated_title": "还没进入关系",
  "dashboard.unauthenticated_description": "正在带你回到入口...",
  "dashboard.owner_view": "主人视角",
  "dashboard.puppy_view": "小狗视角",
  "dashboard.status": "关系状态",
  "dashboard.intimacy": "默契值",
  "dashboard.invite_code": "邀请码",
  "dashboard.no_relationship_title": "还没系上专属牵引",
  "dashboard.no_relationship_description": "先用邀请码接入彼此，后面的命令、表现和奖励才会真正开始。",
  "dashboard.bind_by_invite": "建立专属关系",
  "dashboard.open_tasks": "待执行指令",
  "dashboard.submitted_tasks": "等待审阅",
  "dashboard.approved_tasks": "拿到奖赏",
  "dashboard.wallet": "奖赏匣",
  "dashboard.coins": "奖励币",
  "dashboard.create_task": "下达任务",
  "dashboard.task_list_title": "今日调教清单",
  "dashboard.empty_owner": "还没下达第一道命令，小狗正等着你开口。",
  "dashboard.empty_puppy": "先乖一点等着，主人的下一道安排很快会来。",
  "dashboard.create_task_modal": "下达一条新任务",
  "dashboard.task_title": "任务名称",
  "dashboard.task_title_placeholder": "给这道命令起个名字",
  "dashboard.task_description": "任务内容",
  "dashboard.task_description_placeholder": "告诉对方该怎么表现，才值得被奖赏",
  "dashboard.reward_coins": "奖励筹码",
  "dashboard.deadline": "服从时限",
  "dashboard.no_deadline": "不限时，等你慢慢完成",
  "dashboard.clear_deadline": "清除时限",
  "dashboard.bind_relationship_modal": "建立专属关系",
  "dashboard.invite_code_placeholder": "输入那串只对你开放的邀请码",
  "dashboard.binding": "正在建立牵引...",
  "dashboard.binding_done": "专属关系已接通。",
  "dashboard.create_task_done": "命令已经发出，等对方回应。",
  "dashboard.submission_note": "小狗已从掌控台交出表现",
  "dashboard.reject_reason": "主人暂时不收这份表现",
  "dashboard.task_submitted": "表现已经交上去，乖乖等主人审阅。",
  "dashboard.task_approved": "主人点头了，奖赏已经发下。",
  "dashboard.task_rejected": "这次没过关，回去再练。",
  "dashboard.only_owner_can_create": "只有主人能下达任务。",
  "dashboard.task_status.open": "待执行",
  "dashboard.task_status.submitted": "交任务",
  "dashboard.task_status.approved": "奖赏",
  "dashboard.task_status.rejected": "被打回",
  "dashboard.task_status.expired": "已过期",
  "dashboard.relationship_status.active": "已建立链接",
  "dashboard.relationship_status.pending": "等你确认",
  "dashboard.relationship_status.paused": "已暂停",
  "dashboard.relationship_status.ended": "已结束",
  "bind.title": "接入你的专属关系",
  "bind.description": "拿好那串只属于彼此的暗号，把自己准确送到该回应的人面前。",
  "bind.my_invite_code": "我的专属邀请码",
  "bind.copy_code": "复制暗号",
  "bind.copy_done": "已复制",
  "bind.enter_owner_code": "输入主人的专属暗号",
  "bind.skip_to_dashboard": "先进去看看，晚点再接线",
  "bind.owner_waiting_hint": "把这串暗号递给你的小狗。等对方接上来，命令和奖赏才会真正流动起来。",
  "bind.account_summary": "你的身份卡",
  "bind.open_dashboard": "进入掌控台",
  "bind.source_register": "你的信息已经记下。下一步，把关系接上。",
  "bind.source_login": "你已经回来了。先把专属关系连上，再开始后面的节奏。",
  "dashboard.request_task": "讨一个任务",
  "dashboard.task_request_modal": "向主人讨个任务",
  "dashboard.task_request_title": "这次想讨什么安排？",
  "dashboard.task_request_title_placeholder": "例如：我想要一条更有训练感的任务",
  "dashboard.task_request_note": "撒娇备注",
  "dashboard.task_request_note_placeholder": "补一句让主人更想理你的话",
  "dashboard.task_request_sent": "请求已经递上去，等主人开口。",
  "dashboard.task_request_empty_owner": "现在还没有小狗来讨命令。",
  "dashboard.task_request_empty_puppy": "你还没开口。想被安排的时候，就乖乖来讨一下。",
  "dashboard.task_request_status.pending": "等主人回应",
  "dashboard.task_request_status.fulfilled": "主人已安排",
  "dashboard.task_request_status.rejected": "被主人打回",
  "dashboard.reject_task_request": "打回请求",
  "dashboard.fulfill_task_request": "顺手安排",
  "dashboard.binding_reminder": "你先跳过了接线。关系没连上之前，很多好玩的东西都还锁着。",
  "dashboard.binding_skip_active": "下一步，还是把关系接上。",
  "dashboard.request_queue_title": "小狗讨来的安排",
  "dashboard.my_requests_title": "我讨过的安排",
  "dashboard.linked_task_label": "对应任务",
  "dashboard.task_request_preset.training": "我想要一条带训练感的任务",
  "dashboard.task_request_preset.discipline": "给我一条更守规矩的安排",
  "dashboard.task_request_preset.structured": "今天想被你安排得更具体一点",
  "dashboard.nav.overview": "\u6982\u89c8",
  "dashboard.nav.tasks": "\u4efb\u52a1",
  "dashboard.nav.requests": "\u8bf7\u6c42",
  "dashboard.nav.profile": "\u6211",
  "dashboard.section.overview_hint": "\u5728\u8fd9\u91cc\u770b\u5173\u7cfb\u6982\u51b5\u3001\u8fdb\u5ea6\u548c\u5feb\u901f\u64cd\u4f5c\u3002",
  "dashboard.section.tasks_hint": "\u5728\u8fd9\u91cc\u5904\u7406\u4efb\u52a1\u3001\u5956\u52b1\u548c\u4e0b\u4e00\u6b65\u52a8\u4f5c\u3002",
  "dashboard.section.requests_hint": "\u5728\u8fd9\u91cc\u67e5\u770b\u8ba8\u4efb\u52a1\u7684\u8bb0\u5f55\u3001\u56de\u5e94\u548c\u5f85\u5904\u7406\u51b3\u5b9a\u3002",
  "dashboard.section.profile_hint": "\u5728\u8fd9\u91cc\u786e\u8ba4\u4f60\u7684\u8d26\u53f7\u4fe1\u606f\u3001\u89d2\u8272\u548c\u4f1a\u8bdd\u64cd\u4f5c\u3002",
  "dashboard.task_submission_pick_image": "\u9009\u62e9\u56fe\u7247",
  "dashboard.task_submission_pick_video": "\u9009\u62e9\u89c6\u9891",
  "dashboard.task_submission_no_file": "\u5c1a\u672a\u9009\u62e9\u6587\u4ef6",
  "dashboard.task_submission_image_hint": "\u53ef\u4ece\u76f8\u518c\u9009\u62e9\uff0c\u4e5f\u53ef\u76f4\u63a5\u62cd\u7167\uff08\u5177\u4f53\u53d6\u51b3\u4e8e\u624b\u673a\u6d4f\u89c8\u5668\uff09\u3002",
  "dashboard.task_submission_video_hint": "\u8bf7\u9009\u62e9\u624b\u673a\u4e2d\u7684\u89c6\u9891\u6587\u4ef6\u3002",
  "bind.enter_counterpart_code": "\u8f93\u5165\u5bf9\u65b9\u7684\u4e13\u5c5e\u9080\u8bf7\u7801",
  "bind.counterpart_code_hint": "\u4e3b\u4eba\u548c\u5c0f\u72d7\u90fd\u53ef\u4ee5\u8f93\u5165\u5bf9\u65b9\u7684\u9080\u8bf7\u7801\u6765\u5b8c\u6210\u5339\u914d\u3002",
  "bind.puppy_waiting_hint": "\u8bf7\u627e\u4e3b\u4eba\u5e2e\u4f60\u5e26\u4e0a\u9879\u5708",
  "bind.tab_match": "\u5339\u914d\u5e7f\u573a",
  "bind.tab_invite": "\u9080\u8bf7\u7801",
  "bind.match_intro_label": "\u4f60\u7684\u5339\u914d\u4ecb\u7ecd",
  "bind.match_intro_placeholder": "\u5199\u4e00\u53e5\u7b80\u77ed\u4ecb\u7ecd\uff0c\u8ba9\u5bf9\u65b9\u77e5\u9053\u4f60\u662f\u8c01\u3002",
  "bind.match_create_post": "\u53d1\u5e03\u5230\u5e7f\u573a",
  "bind.match_pick_image": "\u9644\u4e0a\u56fe\u7247",
  "bind.match_accept": "\u63a5\u53d7",
  "bind.match_reject": "\u62d2\u7edd",
  "bind.match_block": "\u62c9\u9ed1",
  "bind.match_report": "\u4e3e\u62a5",
  "bind.match_pending_count": "\u5f85\u5904\u7406\u9080\u8bf7",
  "bind.match_daily_usage": "\u4eca\u65e5\u5df2\u53d1\u9001\u9080\u8bf7",
  "bind.match_status.pending": "\u5f85\u5904\u7406",
  "bind.match_status.accepted": "\u5df2\u63a5\u53d7",
  "bind.match_status.rejected": "\u5df2\u62d2\u7edd",
  "bind.match_status.cancelled": "\u5df2\u53d6\u6d88",
  "bind.community_feed": "\u63a8\u8350",
  "bind.community_inbox": "\u6536\u4ef6",
  "bind.community_mine": "\u6211\u7684",
  "bind.community_publish_post": "\u53d1\u5e03\u52a8\u6001",
  "bind.community_publish_title": "\u53d1\u5e03\u5230\u5339\u914d\u5e7f\u573a",
  "bind.community_publish_hint": "\u5199\u4e00\u53e5\u7b80\u77ed\u4ecb\u7ecd\uff0c\u8ba9\u5bf9\u65b9\u66f4\u5bb9\u6613\u627e\u5230\u4f60\u3002",
  "bind.community_feed_empty": "\u8fd8\u6ca1\u6709\u52a8\u6001\uff0c\u6765\u53d1\u7b2c\u4e00\u6761\u5427\u3002",
  "bind.community_inbox_empty": "\u4f60\u7684\u6536\u4ef6\u7bb1\u6682\u65f6\u6ca1\u6709\u9080\u8bf7\u3002",
  "bind.community_mine_empty": "\u8fd8\u6ca1\u6709\u5728\u7ebf\u5e16\u5b50\u6216\u5df2\u53d1\u9001\u9080\u8bf7\u3002",
  "dashboard.open_match_plaza": "\u524d\u5f80\u5339\u914d\u5e7f\u573a",
  "dashboard.task_submission_requirement": "\u63d0\u4ea4\u51ed\u8bc1",
  "dashboard.task_submission_type.note": "\u6587\u5b57\u8bf4\u660e",
  "dashboard.task_submission_type.image": "\u56fe\u7247",
  "dashboard.task_submission_type.video": "\u89c6\u9891",
  "dashboard.submit_task_modal": "\u63d0\u4ea4\u4efb\u52a1",
  "dashboard.task_submission_note_placeholder": "\u53ef\u9009\uff1a\u7ed9\u4e3b\u4eba\u7684\u5907\u6ce8",
  "dashboard.reward_rule_hint": "\u4efb\u52a1\u901a\u8fc7\u540e\uff0c\u4e3b\u4eba\u548c\u5c0f\u72d7\u5404\u83b7\u5f971\u679a\u94f6\u5e01\uff0c\u6bcf\u5929\u6700\u591a5\u6b21\u3002",
  "dashboard.submitted_at": "\u63d0\u4ea4\u65f6\u95f4",
};

const zhTWMessages: Messages = {
  ...zhCNMessages,
  "common.request_failed": "請求失敗",
  "common.error_occurred": "出錯了，請稍後再試。",
  "common.error_email_registered": "該郵箱已註冊，請直接登入或更換郵箱。",
  "common.error_invalid_credentials": "郵箱或密碼不正確。",
  "common.error_invite_code_not_found": "找不到邀請碼，請檢查後再試。",
  "common.error_invite_code_self": "不能使用自己的邀請碼。",
  "common.loading": "載入中...",
  "common.loading_dashboard": "正在載入儀表板...",
  "common.retry": "重試",
  "common.view_details": "查看詳情",
  "common.redirecting": "正在跳轉...",
  "common.cancel": "取消",
  "common.refresh": "重新整理",
  "common.logout": "登出",
  "common.close": "關閉",
  "common.confirm": "確認",
  "common.email": "電子郵件",
  "common.password": "密碼",
  "common.display_name": "顯示名稱",
  "common.required_password_hint": "至少 8 個字元。",
  "common.role_preference": "角色偏好",
  "common.select_option": "請選擇",
  "common.no_data": "暫無資料",
  "common.nothing_to_show": "目前沒有內容。",
  "error.generic_description": "先緩一緩，稍後再試。",
  "error.page_crashed_description": "重新整理一下，再回來繼續。",
  "login.header_tagline": "主人與乖狗的默契",
  "login.login_title": "回來聽主人的安排",
  "login.register_title": "建立你的專屬歸屬",
  "login.login_description": "輸入電子郵件和密碼，重新回到只屬於你們的節奏裡。",
  "login.register_description": "先留下你的資料，接著去建立那條只對彼此開啟的連結。",
  "login.submit": "進入關係",
  "login.submitting": "正在回到主人身邊...",
  "login.create_account": "建立歸屬",
  "login.creating_account": "正在替你繫上項圈...",
  "login.no_account": "還沒留下你的名字？",
  "login.register_link": "現在歸屬",
  "login.have_account": "已經有歸屬了？",
  "login.back_to_login": "回到入口",
  "login.password_placeholder": "輸入只屬於你的暗號",
  "login.display_name_placeholder": "主人會怎麼叫你",
  "role.owner": "主人",
  "role.puppy": "小狗",
  "dashboard.title": "掌控台",
  "dashboard.unauthenticated_title": "還沒進入關係",
  "dashboard.unauthenticated_description": "正在帶你回到入口...",
  "dashboard.owner_view": "主人視角",
  "dashboard.puppy_view": "小狗視角",
  "dashboard.status": "關係狀態",
  "dashboard.intimacy": "默契值",
  "dashboard.no_relationship_title": "還沒繫上專屬牽引",
  "dashboard.no_relationship_description": "先用邀請碼接入彼此，後面的命令、表現和獎賞才會真正開始。",
  "dashboard.bind_by_invite": "建立專屬關係",
  "dashboard.open_tasks": "待執行指令",
  "dashboard.submitted_tasks": "等待審閱",
  "dashboard.approved_tasks": "拿到獎賞",
  "dashboard.wallet": "獎賞匣",
  "dashboard.coins": "獎勵幣",
  "dashboard.create_task": "下達任務",
  "dashboard.task_list_title": "今日調教清單",
  "dashboard.empty_owner": "還沒下達第一道命令，小狗正等著你開口。",
  "dashboard.empty_puppy": "先乖一點等著，主人的下一道安排很快會來。",
  "dashboard.create_task_modal": "下達一條新任務",
  "dashboard.task_title": "任務名稱",
  "dashboard.task_title_placeholder": "替這道命令取個名字",
  "dashboard.task_description": "任務內容",
  "dashboard.task_description_placeholder": "告訴對方該怎麼表現，才值得被獎賞",
  "dashboard.reward_coins": "獎勵籌碼",
  "dashboard.deadline": "服從時限",
  "dashboard.no_deadline": "不限時，等你慢慢完成",
  "dashboard.clear_deadline": "清除時限",
  "dashboard.binding_done": "專屬關係已接通。",
  "dashboard.create_task_done": "命令已經發出，等對方回應。",
  "dashboard.submission_note": "小狗已從掌控台交出表現",
  "dashboard.reject_reason": "主人暫時不收這份表現",
  "dashboard.task_submitted": "表現已經交上去，乖乖等主人審閱。",
  "dashboard.task_approved": "主人點頭了，獎賞已經發下。",
  "dashboard.task_rejected": "這次沒過關，回去再練。",
  "dashboard.only_owner_can_create": "只有主人能下達任務。",
  "dashboard.task_status.open": "待執行",
  "dashboard.task_status.submitted": "待審閱",
  "dashboard.task_status.approved": "已獎賞",
  "dashboard.task_status.rejected": "被打回",
  "dashboard.task_status.expired": "已過期",
  "dashboard.relationship_status.active": "已連上",
  "dashboard.relationship_status.pending": "等你確認",
  "dashboard.relationship_status.paused": "已暫停",
  "dashboard.relationship_status.ended": "已結束",
  "bind.title": "接入你的專屬關係",
  "bind.description": "拿好那串只屬於彼此的暗號，把自己準確送到該回應的人面前。",
  "bind.my_invite_code": "我的專屬邀請碼",
  "bind.copy_code": "複製暗號",
  "bind.copy_done": "已複製",
  "bind.enter_owner_code": "輸入主人的專屬暗號",
  "bind.skip_to_dashboard": "先進去看看，晚點再接線",
  "bind.owner_waiting_hint": "把這串暗號遞給你的小狗。等對方接上來，命令和獎賞才會真正流動起來。",
  "bind.account_summary": "你的身分卡",
  "bind.open_dashboard": "進入掌控台",
  "bind.source_register": "你的資料已經記下。下一步，把關係接上。",
  "bind.source_login": "你已經回來了。先把專屬關係連上，再開始後面的節奏。",
  "dashboard.request_task": "討一個任務",
  "dashboard.task_request_modal": "向主人討個任務",
  "dashboard.task_request_title": "這次想討什麼安排？",
  "dashboard.task_request_title_placeholder": "例如：我想要一條更有訓練感的任務",
  "dashboard.task_request_note": "撒嬌備註",
  "dashboard.task_request_note_placeholder": "補一句讓主人更想理你的話",
  "dashboard.task_request_sent": "請求已經遞上去，等主人開口。",
  "dashboard.task_request_empty_owner": "現在還沒有小狗來討命令。",
  "dashboard.task_request_empty_puppy": "你還沒開口。想被安排的時候，就乖乖來討一下。",
  "dashboard.task_request_status.pending": "等主人回應",
  "dashboard.task_request_status.fulfilled": "主人已安排",
  "dashboard.task_request_status.rejected": "被主人打回",
  "dashboard.reject_task_request": "打回請求",
  "dashboard.fulfill_task_request": "順手安排",
  "dashboard.binding_reminder": "你先跳過了接線。關係沒連上之前，很多好玩的東西都還鎖著。",
  "dashboard.binding_skip_active": "下一步，還是把關係接上。",
  "dashboard.request_queue_title": "小狗討來的安排",
  "dashboard.my_requests_title": "我討過的安排",
  "dashboard.linked_task_label": "對應任務",
  "dashboard.task_request_preset.training": "我想要一條帶訓練感的任務",
  "dashboard.task_request_preset.discipline": "給我一條更守規矩的安排",
  "dashboard.task_request_preset.structured": "今天想被你安排得更具體一點",
  "dashboard.nav.overview": "\u6982\u89bd",
  "dashboard.nav.tasks": "\u4efb\u52d9",
  "dashboard.nav.requests": "\u8acb\u6c42",
  "dashboard.nav.profile": "\u6211",
  "dashboard.section.overview_hint": "\u5728\u9019\u88e1\u770b\u95dc\u4fc2\u6982\u6cc1\u3001\u9032\u5ea6\u548c\u5feb\u901f\u64cd\u4f5c\u3002",
  "dashboard.section.tasks_hint": "\u5728\u9019\u88e1\u8655\u7406\u4efb\u52d9\u3001\u734e\u8cde\u548c\u4e0b\u4e00\u6b65\u52d5\u4f5c\u3002",
  "dashboard.section.requests_hint": "\u5728\u9019\u88e1\u67e5\u770b\u8a0e\u4efb\u52d9\u8a18\u9304\u3001\u56de\u61c9\u548c\u5f85\u8655\u7406\u6c7a\u5b9a\u3002",
  "dashboard.section.profile_hint": "\u5728\u9019\u88e1\u78ba\u8a8d\u4f60\u7684\u5e33\u865f\u8cc7\u8a0a\u3001\u89d2\u8272\u548c\u5de5\u4f5c\u968e\u6bb5\u3002",
  "dashboard.task_submission_pick_image": "\u9078\u64c7\u5716\u7247",
  "dashboard.task_submission_pick_video": "\u9078\u64c7\u5f71\u7247",
  "dashboard.task_submission_no_file": "\u5c1a\u672a\u9078\u64c7\u6a94\u6848",
  "dashboard.task_submission_image_hint": "\u53ef\u5f9e\u76f8\u7c3f\u9078\u64c7\uff0c\u4e5f\u53ef\u76f4\u63a5\u62cd\u7167\uff08\u5be6\u969b\u4f9d\u624b\u6a5f\u700f\u89bd\u5668\u800c\u5b9a\uff09\u3002",
  "dashboard.task_submission_video_hint": "\u8acb\u9078\u64c7\u624b\u6a5f\u4e2d\u7684\u5f71\u7247\u6a94\u6848\u3002",
  "bind.enter_counterpart_code": "\u8f38\u5165\u5c0d\u65b9\u7684\u5c08\u5c6c\u9080\u8acb\u78bc",
  "bind.counterpart_code_hint": "\u4e3b\u4eba\u548c\u5c0f\u72d7\u90fd\u53ef\u4ee5\u8f38\u5165\u5c0d\u65b9\u7684\u9080\u8acb\u78bc\u4f86\u5b8c\u6210\u914d\u5c0d\u3002",
  "bind.puppy_waiting_hint": "\u8acb\u627e\u4e3b\u4eba\u5e6b\u4f60\u6234\u4e0a\u9805\u5708",
  "bind.tab_match": "\u914d\u5c0d\u5ee3\u5834",
  "bind.tab_invite": "\u9080\u8acb\u78bc",
  "bind.match_intro_label": "\u4f60\u7684\u914d\u5c0d\u4ecb\u7d39",
  "bind.match_intro_placeholder": "\u5beb\u4e00\u53e5\u7c21\u77ed\u4ecb\u7d39\uff0c\u8b93\u5c0d\u65b9\u77e5\u9053\u4f60\u662f\u8ab0\u3002",
  "bind.match_create_post": "\u767c\u5e03\u5230\u5ee3\u5834",
  "bind.match_pick_image": "\u9644\u4e0a\u5716\u7247",
  "bind.match_accept": "\u63a5\u53d7",
  "bind.match_reject": "\u62d2\u7d55",
  "bind.match_block": "\u5c01\u9396",
  "bind.match_report": "\u6aa2\u8209",
  "bind.match_pending_count": "\u5f85\u8655\u7406\u9080\u8acb",
  "bind.match_daily_usage": "\u4eca\u65e5\u5df2\u9001\u51fa\u9080\u8acb",
  "bind.match_status.pending": "\u5f85\u8655\u7406",
  "bind.match_status.accepted": "\u5df2\u63a5\u53d7",
  "bind.match_status.rejected": "\u5df2\u62d2\u7d55",
  "bind.match_status.cancelled": "\u5df2\u53d6\u6d88",
  "bind.community_feed": "\u63a8\u85a6",
  "bind.community_inbox": "\u6536\u4ef6",
  "bind.community_mine": "\u6211\u7684",
  "bind.community_publish_post": "\u767c\u5e03\u52d5\u614b",
  "bind.community_publish_title": "\u767c\u5e03\u5230\u914d\u5c0d\u5ee3\u5834",
  "bind.community_publish_hint": "\u5beb\u4e00\u53e5\u7c21\u77ed\u4ecb\u7d39\uff0c\u8b93\u5c0d\u65b9\u66f4\u5bb9\u6613\u627e\u5230\u4f60\u3002",
  "bind.community_feed_empty": "\u9084\u6c92\u6709\u52d5\u614b\uff0c\u4f86\u767c\u7b2c\u4e00\u5247\u5427\u3002",
  "bind.community_inbox_empty": "\u4f60\u7684\u6536\u4ef6\u7bb1\u66ab\u6642\u6c92\u6709\u9080\u8acb\u3002",
  "bind.community_mine_empty": "\u9084\u6c92\u6709\u4e0a\u7dda\u5e16\u6587\u6216\u5df2\u9001\u51fa\u7684\u9080\u8acb\u3002",
  "dashboard.open_match_plaza": "\u524d\u5f80\u914d\u5c0d\u5ee3\u5834",
  "dashboard.task_submission_requirement": "\u63d0\u4ea4\u61d1\u8b49",
  "dashboard.task_submission_type.note": "\u6587\u5b57\u8aaa\u660e",
  "dashboard.task_submission_type.image": "\u5716\u7247",
  "dashboard.task_submission_type.video": "\u5f71\u7247",
  "dashboard.submit_task_modal": "\u63d0\u4ea4\u4efb\u52d9",
  "dashboard.task_submission_note_placeholder": "\u53ef\u9078\uff1a\u7d66\u4e3b\u4eba\u7684\u5099\u8a3b",
  "dashboard.reward_rule_hint": "\u4efb\u52d9\u901a\u904e\u5f8c\uff0c\u4e3b\u4eba\u8207\u5c0f\u72d7\u5404\u7372\u5f971\u679a\u786c\u5e63\uff0c\u6bcf\u65e5\u6700\u591a5\u6b21\u3002",
  "dashboard.submitted_at": "\u63d0\u4ea4\u6642\u9593",
};

const frMessages: Messages = {
  ...enMessages,
  "common.request_failed": "Echec de la requete",
  "common.error_occurred": "Une erreur est survenue. Veuillez reessayer.",
  "common.error_email_registered": "Cet e-mail est deja enregistre. Connectez-vous ou utilisez un autre e-mail.",
  "common.error_invalid_credentials": "E-mail ou mot de passe incorrect.",
  "common.error_invite_code_not_found": "Code d'invitation introuvable. Verifiez et reessayez.",
  "common.error_invite_code_self": "Vous ne pouvez pas utiliser votre propre code d'invitation.",
  "common.loading": "Chargement...",
  "common.loading_dashboard": "Chargement du tableau de bord...",
  "common.retry": "Reessayer",
  "common.view_details": "Voir les details",
  "common.redirecting": "Redirection...",
  "common.cancel": "Annuler",
  "common.refresh": "Actualiser",
  "common.logout": "Se deconnecter",
  "common.language": "Langue",
  "common.close": "Fermer",
  "common.confirm": "Confirmer",
  "common.email": "E-mail",
  "common.password": "Mot de passe",
  "common.display_name": "Nom affiche",
  "common.required_password_hint": "Au moins 8 caracteres.",
  "common.role_preference": "Preference de role",
  "common.select_option": "Selectionner une option",
  "common.no_data": "Aucune donnee",
  "common.nothing_to_show": "Rien a afficher pour le moment.",
  "error.generic_title": "Un probleme est survenu",
  "error.generic_description": "Reessayez dans un instant.",
  "error.page_crashed_title": "La page a plante",
  "error.page_crashed_description": "Actualisez puis reessayez.",
  "login.header_tagline": "Maitre et chiot",
  "login.login_title": "Connexion",
  "login.register_title": "Creer un compte",
  "login.login_description": "Entrez votre e-mail et votre mot de passe pour ouvrir le tableau de bord.",
  "login.register_description": "Apres inscription, vous passerez par le guide de liaison.",
  "login.submit": "Se connecter",
  "login.submitting": "Connexion...",
  "login.create_account": "Creer un compte",
  "login.creating_account": "Creation...",
  "login.no_account": "Pas encore de compte ?",
  "login.register_link": "S'inscrire",
  "login.have_account": "Vous avez deja un compte ?",
  "login.back_to_login": "Retour a la connexion",
  "role.owner": "Maitre",
  "role.puppy": "Chiot",
  "dashboard.title": "Tableau de bord",
  "dashboard.unauthenticated_title": "Non connecte",
  "dashboard.unauthenticated_description": "Redirection vers la connexion...",
  "dashboard.owner_view": "Vue maitre",
  "dashboard.puppy_view": "Vue chiot",
  "dashboard.status": "Statut",
  "dashboard.intimacy": "Intimite",
  "dashboard.invite_code": "Code d'invitation",
  "dashboard.no_relationship_title": "Aucune relation pour l'instant",
  "dashboard.no_relationship_description": "Utilisez un code d'invitation pour lier deux comptes avant de creer des taches.",
  "dashboard.bind_by_invite": "Lier avec un code",
  "dashboard.open_tasks": "Taches ouvertes",
  "dashboard.submitted_tasks": "Taches soumises",
  "dashboard.approved_tasks": "Taches approuvees",
  "dashboard.wallet": "Portefeuille",
  "dashboard.coins": "pieces",
  "dashboard.create_task": "Creer une tache",
  "dashboard.task_list_title": "Liste des taches",
  "dashboard.empty_owner": "Creez la premiere tache pour lancer la boucle.",
  "dashboard.empty_puppy": "Attendez que le maitre cree une tache.",
  "dashboard.create_task_modal": "Creer une tache",
  "dashboard.task_title": "Titre de la tache",
  "dashboard.task_title_placeholder": "Entrez un titre",
  "dashboard.task_description": "Description de la tache",
  "dashboard.task_description_placeholder": "Entrez une description",
  "dashboard.reward_coins": "Pieces de recompense",
  "dashboard.deadline": "Echeance",
  "dashboard.no_deadline": "Sans echeance",
  "dashboard.binding_done": "Relation creee.",
  "dashboard.create_task_done": "Tache creee.",
  "dashboard.submission_note": "Soumis depuis le tableau de bord",
  "dashboard.reject_reason": "Rejete depuis le tableau de bord",
  "dashboard.task_submitted": "Tache soumise.",
  "dashboard.task_approved": "Tache approuvee.",
  "dashboard.task_rejected": "Tache rejetee.",
  "dashboard.only_owner_can_create": "Seul le maitre peut creer des taches.",
  "dashboard.task_status.open": "Ouverte",
  "dashboard.task_status.submitted": "Soumise",
  "dashboard.task_status.approved": "Approuvee",
  "dashboard.task_status.rejected": "Rejetee",
  "dashboard.task_status.expired": "Expiree",
  "dashboard.relationship_status.active": "Active",
  "dashboard.relationship_status.pending": "En attente",
  "dashboard.relationship_status.paused": "En pause",
  "dashboard.relationship_status.ended": "Terminee",
  "bind.title": "Liez votre relation",
  "bind.description": "Consultez votre code d'invitation et connectez-vous a la bonne personne sans chercher partout.",
  "bind.my_invite_code": "Mon code d'invitation",
  "bind.copy_code": "Copier le code",
  "bind.copy_done": "Copie",
  "bind.enter_owner_code": "Entrer le code du maitre",
  "bind.enter_counterpart_code": "Entrer le code d'invitation de l'autre personne",
  "bind.counterpart_code_hint": "Le maitre comme le chiot peuvent entrer le code de l'autre pour etre associes.",
  "bind.skip_to_dashboard": "Plus tard, afficher d'abord le tableau de bord",
  "bind.owner_waiting_hint": "Partagez votre code avec un chiot. Une fois lie, le cycle complet sera disponible.",
  "bind.puppy_waiting_hint": "Demandez au maitre de vous partager son code pour vous lier.",
  "bind.account_summary": "Resume du compte",
  "bind.open_dashboard": "Ouvrir le tableau de bord",
  "bind.source_register": "Votre compte est pret. Commencez par la liaison.",
  "bind.source_login": "Vous etes connecte. Terminez la liaison pour debloquer le flux complet.",
  "dashboard.request_task": "Demander une tache",
  "dashboard.task_request_modal": "Demander une tache",
  "dashboard.task_request_title": "Que voulez-vous demander ?",
  "dashboard.task_request_title_placeholder": "Par exemple : je veux une tache d'entrainement",
  "dashboard.task_request_note": "Note supplementaire",
  "dashboard.task_request_note_placeholder": "Details optionnels pour votre maitre",
  "dashboard.task_request_sent": "Demande envoyee.",
  "dashboard.task_request_empty_owner": "Aucune demande de votre chiot pour le moment.",
  "dashboard.task_request_empty_puppy": "Aucune demande envoyee. Faites-en une quand vous voulez une direction.",
  "dashboard.task_request_status.pending": "En attente",
  "dashboard.task_request_status.fulfilled": "Traitee",
  "dashboard.task_request_status.rejected": "Rejetee",
  "dashboard.reject_task_request": "Refuser la demande",
  "dashboard.fulfill_task_request": "Creer la tache",
  "dashboard.binding_reminder": "Vous avez ignore la liaison pour l'instant. Les actions principales restent limitees.",
  "dashboard.binding_skip_active": "La liaison reste l'etape suivante.",
  "dashboard.request_queue_title": "Demandes du chiot",
  "dashboard.my_requests_title": "Mes demandes",
  "dashboard.linked_task_label": "Tache liee",
  "dashboard.task_request_preset.training": "Je veux une tache d'entrainement",
  "dashboard.task_request_preset.discipline": "Donne-moi une tache de discipline",
  "dashboard.task_request_preset.structured": "Je veux quelque chose de structure aujourd'hui",
  "dashboard.nav.overview": "Apercu",
  "dashboard.nav.tasks": "Taches",
  "dashboard.nav.requests": "Demandes",
  "dashboard.nav.profile": "Profil",
  "dashboard.section.overview_hint": "Retrouvez ici le resume, les statistiques et les actions rapides.",
  "dashboard.section.tasks_hint": "Consultez les taches, les recompenses et la prochaine action attendue.",
  "dashboard.section.requests_hint": "Suivez les demandes, les reponses et les decisions encore en attente.",
  "dashboard.section.profile_hint": "Verifiez votre identite, votre role et les actions de session.",
};

export const messages: Record<Locale, Messages> = {
  "zh-CN": zhCNMessages,
  en: enMessages,
  "zh-TW": zhTWMessages,
  fr: frMessages,
};
