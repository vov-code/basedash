import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Webhook для обработки транзакций
 * Вызывается после подтверждения транзакции в Base Mini App
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Логирование webhook события
    console.log('Webhook received:', body)
    
    // Проверка типа события
    const { event, transactionHash, status } = body
    
    if (status === 'success') {
      // Обработка успешной транзакции
      console.log('Transaction confirmed:', transactionHash)
      
      // Здесь можно добавить дополнительную логику:
      // - Обновление кэша лидерборда
      // - Отправка уведомлений
      // - Аналитика
      
      return NextResponse.json({ 
        success: true,
        message: 'Webhook processed successfully'
      })
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Webhook received but transaction not successful'
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process webhook' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Webhook endpoint is ready'
  })
}
