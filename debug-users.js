const { createClient } = require('@supabase/supabase-js')

// Você precisa colocar suas variáveis de ambiente aqui
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUsers() {
  console.log('🔍 Testing users query...')
  console.log('📍 Supabase URL:', supabaseUrl)
  console.log('🔑 Has key:', !!supabaseKey)

  try {
    // Teste 1: Contar todos os registros
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    console.log('📊 Total users count:', count, countError)

    // Teste 2: Buscar alguns campos básicos
    const { data, error } = await supabase
      .from('users')
      .select('id, email, company_name')
      .limit(10)

    console.log('👥 Users data:', data)
    console.log('❌ Error:', error)

    // Teste 3: Verificar se a tabela existe
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables')
      .then(res => res)
      .catch(() => ({ data: 'RPC not available', error: null }))

    console.log('📋 Tables check:', tables, tablesError)

  } catch (err) {
    console.error('💥 Unexpected error:', err)
  }
}

testUsers()