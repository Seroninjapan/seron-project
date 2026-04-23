import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

const DEFAULT_QUESTIONS = {
  '飲食': [
    'メニューの多言語対応は十分でしたか？',
    'スタッフの外国語での挨拶・接客はどうでしたか？',
    '料理の説明（アレルギー・食材）は理解できましたか？',
    '会計・支払い時の対応はスムーズでしたか？',
    'Google Maps / OTAの掲載情報と実際の店舗に差異はありましたか？',
    '店内の清潔感・雰囲気は外国人観光客にとって快適でしたか？',
    '予約導線（電話・Web・OTA）はスムーズでしたか？',
  ],
  '宿泊': [
    'チェックイン時の外国語対応はスムーズでしたか？',
    '客室内の案内（Wi-Fi・設備説明）は多言語対応でしたか？',
    'フロント・コンシェルジュへの問い合わせ対応はどうでしたか？',
    '館内表示・サイン（トイレ・大浴場等）は分かりやすかったですか？',
    'OTA（Booking.com等）の掲載情報と実際の施設に差異はありましたか？',
    'チェックアウト・精算はスムーズでしたか？',
    '周辺情報の案内（観光地・交通）は十分でしたか？',
  ],
  '観光施設': [
    'チケット購入・入場の多言語対応はどうでしたか？',
    '施設内の案内表示は分かりやすかったですか？',
    'スタッフの外国語対応はどうでしたか？',
    '展示・体験の説明は理解できましたか？',
    'Google Maps / OTAの掲載情報と実際に差異はありましたか？',
    '施設全体の清潔感・快適さはどうでしたか？',
  ],
  'その他': [
    '外国語での案内・対応はどうでしたか？',
    'サービス内容は事前情報と一致していましたか？',
    'スタッフの対応は親切でしたか？',
    '施設・店舗の清潔感はどうでしたか？',
    'Google Maps等の掲載情報は正確でしたか？',
  ],
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [client, setClient] = useState(null)
  const [tab, setTab] = useState('home')
  const [missions, setMissions] = useState([])
  const [applications, setApplications] = useState([])
  const [reports, setReports] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [formType, setFormType] = useState('飲食')
  const [questions, setQuestions] = useState([...DEFAULT_QUESTIONS['飲食']])
  const [formData, setFormData] = useState({ title: '', venueName: '', area: '', lang: '英語', date: '', count: '1名', desc: '', perk: '' })
  const [formImages, setFormImages] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (client) {
      loadMissions()
      loadApplications()
      loadReports()
    }
  }, [client])

  const loadProfile = async (user) => {
    let { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) {
      const { data: newProf } = await supabase.from('profiles').insert({
        id: user.id, role: 'client',
        display_name: user.user_metadata.full_name || user.email,
        email: user.email, avatar_url: user.user_metadata.avatar_url,
      }).select().single()
      prof = newProf
    }
    setProfile(prof)
    let { data: cl } = await supabase.from('clients').select('*').eq('profile_id', user.id).single()
    if (!cl) {
      const { data: newCl } = await supabase.from('clients').insert({
        profile_id: user.id, venue_name: '未設定', venue_type: '飲食', area: '未設定',
      }).select().single()
      cl = newCl
    }
    setClient(cl)
  }

  const loadMissions = async () => {
    const { data } = await supabase.from('missions').select('*').eq('client_id', client.id).order('created_at', { ascending: false })
    setMissions(data || [])
  }

  const loadApplications = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, monitors(profile_id, languages, profiles(display_name, avatar_url)), missions(title)')
      .in('mission_id', missions.map(m => m.id))
    setApplications(data || [])
  }

  const loadReports = async () => {
    const { data } = await supabase.from('reports').select('*, missions(title)').eq('client_id', client.id).order('submitted_at', { ascending: false })
    setReports(data || [])
  }

  const handleTypeChange = (type) => {
    setFormType(type)
    setQuestions([...DEFAULT_QUESTIONS[type]])
  }

  const updateQuestion = (idx, val) => {
    const next = [...questions]; next[idx] = val; setQuestions(next)
  }

  const removeQuestion = (idx) => {
    if (questions.length <= 5) return
    setQuestions(questions.filter((_, i) => i !== idx))
  }

  const addQuestion = () => {
    if (questions.length >= 10) return
    setQuestions([...questions, ''])
  }

  const submitMission = async () => {
    if (!formData.title) { showToast('タイトルを入力してください'); return }
    if (!formData.venueName) { showToast('店舗名を入力してください'); return }

    let clientId = client?.id
    if (!clientId) {
      const { data: newClient, error: clientError } = await supabase.from('clients').insert({
        profile_id: session.user.id,
        venue_name: formData.venueName,
        venue_type: formType,
        area: formData.area || '未設定',
      }).select().single()
      if (clientError) { showToast('クライアント情報の作成に失敗しました'); return }
      setClient(newClient)
      clientId = newClient.id
    } else {
      // 店舗名とエリアを更新
      await supabase.from('clients').update({
        venue_name: formData.venueName,
        venue_type: formType,
        area: formData.area || client.area,
      }).eq('id', clientId)
      setClient({ ...client, venue_name: formData.venueName, area: formData.area || client.area })
    }

    const { error } = await supabase.from('missions').insert({
      client_id: clientId,
      title: formData.title,
      description: formData.desc,
      venue_type: formType,
      required_languages: [formData.lang],
      questions: questions,
      monitor_count: parseInt(formData.count) || 1,
      preferred_date: formData.date,
      perk: formData.perk || `Free ${formType === '宿泊' ? '1-night stay' : 'dining'}`,
      images: formImages,
      status: '審査中',
    })
    if (error) { showToast('エラーが発生しました: ' + error.message); return }
    showToast('案件を登録しました')
    setShowForm(false)
    setFormData({ title: '', venueName: '', area: '', lang: '英語', date: '', count: '1名', desc: '', perk: '' })
    setFormImages([])
    setQuestions([...DEFAULT_QUESTIONS['飲食']])
    loadMissions()
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (formImages.length + files.length > 5) {
      showToast('画像は最大5枚までです')
      return
    }
    setUploadingImages(true)
    const uploaded = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`
      const { data, error } = await supabase.storage
        .from('mission-images')
        .upload(fileName, file)
      if (!error) {
        const { data: urlData } = supabase.storage
          .from('mission-images')
          .getPublicUrl(fileName)
        uploaded.push(urlData.publicUrl)
      }
    }
    setFormImages([...formImages, ...uploaded])
    setUploadingImages(false)
  }

  const removeImage = (idx) => {
    setFormImages(formImages.filter((_, i) => i !== idx))
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null); setProfile(null); setClient(null)
  }

  if (loading) return <Loader />
  if (!session) return <LoginScreen onLogin={signInWithGoogle} />

  const pendingApps = applications.filter(a => a.status === 'pending').length
  const matchedApps = applications.filter(a => a.status === 'matched').length

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', background: '#F8F8F6', minHeight: '100vh', fontFamily: "-apple-system, 'Hiragino Kaku Gothic ProN', sans-serif", color: '#1A1A1A' }}>

      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#1A9E6F', color: '#FFF', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 300 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#FFF', borderBottom: '1px solid #EBEBEB', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: '#1A9E6F', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 800 }}>S</div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Seron</span>
          <span style={{ fontSize: 11, color: '#999', background: '#F0F0F0', padding: '2px 8px', borderRadius: 4 }}>クライアント</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {profile?.avatar_url && <img src={profile.avatar_url} style={{ width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }} onClick={() => setTab('settings')} />}
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{ display: 'flex', background: '#FFF', borderBottom: '1px solid #EBEBEB', padding: '0 20px' }}>
        {[
          { key: 'home', label: 'ダッシュボード' },
          { key: 'missions', label: '案件管理' },
          { key: 'reports', label: 'レポート' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '12px 16px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? '#1A9E6F' : '#999',
            borderBottom: tab === t.key ? '2px solid #1A9E6F' : '2px solid transparent',
            background: 'none', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 20 }}>

        {/* HOME */}
        {tab === 'home' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{client?.venue_name}</div>
              <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>{client?.area} · {client?.venue_type}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { num: missions.length, label: '掲載案件', color: '#1A9E6F' },
                { num: applications.length, label: '応募数', color: '#1A1A1A' },
                { num: reports.length, label: 'レポート受領', color: '#FF8C42' },
                { num: pendingApps, label: '審査中応募', color: '#1A9E6F' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#FFF', border: '1px solid #EBEBEB', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.num}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>クイックアクション</div>
              <button onClick={() => { setTab('missions'); setShowForm(true) }} style={{ width: '100%', padding: 14, background: '#1A9E6F', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>＋ 新しい案件を登録する</button>
              <button onClick={() => setTab('reports')} style={{ width: '100%', padding: 14, background: '#FFF', color: '#1A1A1A', border: '1px solid #EBEBEB', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>レポートを確認する</button>
            </div>

            {missions.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>最近の案件</div>
                {missions.slice(0, 2).map(m => <MissionRow key={m.id} m={m} />)}
              </>
            )}
          </div>
        )}

        {/* MISSIONS */}
        {tab === 'missions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>案件管理</div>
              <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', background: showForm ? '#E74C3C' : '#1A9E6F', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {showForm ? '✕ 閉じる' : '＋ 新規登録'}
              </button>
            </div>

            {showForm && (
              <div style={{ background: '#FFF', border: '1px solid #EBEBEB', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>案件を登録する</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>店舗名 *</label>
                    <input value={formData.venueName} onChange={e => setFormData({ ...formData, venueName: e.target.value })} placeholder="例：田中鮨 難波店" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>エリア</label>
                    <input value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} placeholder="例：難波" style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>案件タイトル *</label>
                  <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="例：英語メニュー・接客の評価" style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>カテゴリ</label>
                    <select value={formType} onChange={e => handleTypeChange(e.target.value)} style={inputStyle}>
                      <option>飲食</option><option>宿泊</option><option>観光施設</option><option>その他</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>希望言語</label>
                    <select value={formData.lang} onChange={e => setFormData({ ...formData, lang: e.target.value })} style={inputStyle}>
                      <option>英語</option><option>中国語（簡体）</option><option>中国語（繁体）</option><option>韓国語</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>実施希望時期</label>
                    <input type="month" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>モニター人数</label>
                    <select value={formData.count} onChange={e => setFormData({ ...formData, count: e.target.value })} style={inputStyle}>
                      <option>1名</option><option>2名</option><option>3名以上</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>特典内容</label>
                  <input value={formData.perk} onChange={e => setFormData({ ...formData, perk: e.target.value })} placeholder="例：Free dining for 2" style={inputStyle} />
                </div>

                {/* Image Upload */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>店舗・施設の画像（最大5枚）</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    {formImages.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative', width: 72, height: 72 }}>
                        <img src={url} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '1px solid #DDD' }} />
                        <button onClick={() => removeImage(idx)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#E74C3C', color: 'white', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ))}
                    {formImages.length < 5 && (
                      <label style={{ width: 72, height: 72, borderRadius: 8, border: '1px dashed #CCC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#F8F8F6', fontSize: 11, color: '#999', gap: 4 }}>
                        {uploadingImages ? '...' : <><span style={{ fontSize: 20 }}>+</span><span>追加</span></>}
                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadingImages} />
                      </label>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#999' }}>{formImages.length}/5枚</div>
                </div>

                {/* Questions */}
                <div style={{ background: '#F8F8F6', border: '1px solid #EBEBEB', borderRadius: 10, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>評価質問項目</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{questions.length}/10件</div>
                    </div>
                  </div>
                  {questions.map((q, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#999', fontWeight: 600, width: 20, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                      <input value={q} onChange={e => updateQuestion(idx, e.target.value)} placeholder="質問を入力..." style={{ ...inputStyle, margin: 0 }} />
                      <button onClick={() => removeQuestion(idx)} disabled={questions.length <= 5} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: questions.length <= 5 ? 'not-allowed' : 'pointer', background: questions.length <= 5 ? '#F0F0F0' : '#FCEBEB', color: questions.length <= 5 ? '#CCC' : '#E74C3C', fontSize: 14, flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  {questions.length < 10 && (
                    <button onClick={addQuestion} style={{ width: '100%', padding: 10, background: '#FFF', border: '1px dashed #CCC', borderRadius: 8, fontSize: 13, color: '#1A9E6F', fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                      ＋ 質問を追加（残り{10 - questions.length}件）
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>補足事項（任意）</label>
                  <textarea value={formData.desc} onChange={e => setFormData({ ...formData, desc: e.target.value })} placeholder="モニターに事前に伝えたいことがあれば" style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
                </div>

                <button onClick={submitMission} style={{ width: '100%', padding: 12, background: '#1A9E6F', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>登録する</button>
              </div>
            )}

            {missions.length === 0 && !showForm && <Empty text="まだ案件がありません" />}
            {missions.map(m => <MissionRow key={m.id} m={m} expanded />)}

            {applications.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, marginTop: 24 }}>応募者一覧</div>
                {applications.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF', border: '1px solid #EBEBEB', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E8F7F0', color: '#1A9E6F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
                        {a.monitors?.profiles?.display_name?.[0] || 'M'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{a.monitors?.profiles?.display_name || 'モニター'}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{a.missions?.title}</div>
                      </div>
                    </div>
                    <StatusBadge status={a.status === 'pending' ? '審査中' : a.status === 'matched' ? 'マッチング済' : '完了'} />
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>レポート</div>
            {reports.length === 0 && <Empty text="まだレポートはありません" />}
            {reports.map((r, i) => (
              <div key={i} style={{ background: '#FFF', border: '1px solid #EBEBEB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{r.missions?.title}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{new Date(r.submitted_at).toLocaleDateString('ja-JP')}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#1A9E6F' }}>{r.overall_score}</div>
                    <div style={{ fontSize: 10, color: '#999' }}>/ 5.0</div>
                  </div>
                </div>

                {r.scores?.map((s, si) => (
                  <div key={si} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#555' }}>{s.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.score >= 4 ? '#1A9E6F' : s.score >= 3 ? '#FF8C42' : '#E74C3C' }}>{s.score}</span>
                    </div>
                    <div style={{ height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(s.score / 5) * 100}%`, background: s.score >= 4 ? '#1A9E6F' : s.score >= 3 ? '#FF8C42' : '#E74C3C', borderRadius: 3 }}></div>
                    </div>
                  </div>
                ))}

                {r.good_points && (
                  <div style={{ background: '#F8F8F6', borderRadius: 8, padding: '12px 14px', marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>👍 良かった点</div>
                    <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>{r.good_points}</p>
                  </div>
                )}

                {r.improve_points && (
                  <div style={{ background: '#F8F8F6', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>📝 改善ポイント</div>
                    <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>{r.improve_points}</p>
                  </div>
                )}

                {r.suggestions?.length > 0 && (
                  <div style={{ background: '#E8F7F0', border: '1px solid #C5E8D8', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0E6B4A', marginBottom: 8 }}>✅ Seronからの改善提案</div>
                    {r.suggestions.map((s, si) => (
                      <div key={si} style={{ display: 'flex', gap: 8, marginBottom: si < r.suggestions.length - 1 ? 8 : 0 }}>
                        <span style={{ fontSize: 12, color: '#1A9E6F', fontWeight: 700, flexShrink: 0 }}>{si + 1}.</span>
                        <span style={{ fontSize: 13, color: '#0E6B4A', lineHeight: 1.6 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS */}
        {tab === 'settings' && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>設定</div>
            <div style={{ background: '#FFF', border: '1px solid #EBEBEB', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { label: '店舗名', value: client?.venue_name },
                { label: '業種', value: client?.venue_type },
                { label: 'エリア', value: client?.area },
                { label: 'メールアドレス', value: profile?.email },
              ].map((item, i, arr) => (
                <div key={i} style={{ padding: '16px 20px', borderBottom: i < arr.length - 1 ? '1px solid #EBEBEB' : 'none' }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 15 }}>{item.value || '未設定'}</div>
                </div>
              ))}
            </div>
            <button onClick={signOut} style={{ width: '100%', padding: 14, background: 'transparent', color: '#E74C3C', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>ログアウト</button>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #DDD', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#FFF', fontFamily: 'inherit' }

function MissionRow({ m, expanded }) {
  const statusMap = { '審査中': { bg: '#FFF3E0', color: '#E65100' }, '公開中': { bg: '#E8F7F0', color: '#0E6B4A' }, '完了': { bg: '#F0F0F0', color: '#999' } }
  const s = statusMap[m.status] || statusMap['審査中']
  return (
    <div style={{ background: '#FFF', border: '1px solid #EBEBEB', borderRadius: 12, padding: 16, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{m.preferred_date} · {m.venue_type}</div>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{m.status}</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = { '公開中': { bg: '#E8F7F0', color: '#0E6B4A' }, '審査中': { bg: '#FFF3E0', color: '#E65100' }, '完了': { bg: '#F0F0F0', color: '#999' }, 'マッチング済': { bg: '#E8F7F0', color: '#0E6B4A' } }
  const s = styles[status] || styles['審査中']
  return <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{status}</span>
}

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#CCC', fontSize: 14 }}>{text}</div>
}

function Loader() {
  return <div style={{ background: '#F8F8F6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#1A9E6F', fontSize: 20, fontWeight: 700 }}>Seron</div></div>
}

function LoginScreen({ onLogin }) {
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', background: '#F8F8F6', minHeight: '100vh', fontFamily: "-apple-system, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
      <div style={{ width: 56, height: 56, background: '#1A9E6F', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 20 }}>S</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Seron クライアント</div>
      <div style={{ fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 40, lineHeight: 1.6 }}>店舗・施設のインバウンド対応を<br />モニタリングで改善する</div>
      <button onClick={onLogin} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', background: '#FFF', color: '#333', border: '1px solid #DDD', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
        <span style={{ fontSize: 18 }}>G</span>
        Googleでログイン
      </button>
    </div>
  )
}
