$pptxPath = "C:\Users\asus\confidence-ai\ConfidenceAI_MiniProject_Proposal.pptx"
$pdfPath = "C:\Users\asus\confidence-ai\ConfidenceAI_MiniProject_Proposal.pdf"
$pdfPath2 = "C:\Users\asus\confidence-ai\ConfidenceAI_Presentation.pdf"
$pdfPath3 = "C:\Users\asus\confidence-ai\ConfidenceAI_BTech_Presentation.pdf"

Write-Host "Starting PowerPoint COM automation..."
$pp = New-Object -ComObject PowerPoint.Application

try {
    Write-Host "Opening presentation: $pptxPath"
    $pres = $pp.Presentations.Open($pptxPath, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    
    Write-Host "Exporting to PDF: $pdfPath"
    # 32 represents ppSaveAsPDF
    $pres.SaveAs($pdfPath, 32)
    
    Write-Host "Exporting to PDF: $pdfPath2"
    $pres.SaveAs($pdfPath2, 32)

    Write-Host "Exporting to PDF: $pdfPath3"
    $pres.SaveAs($pdfPath3, 32)
    
    $pres.Close()
    Write-Host "PDF export completed successfully!"
}
catch {
    Write-Error "Error during PDF export: $_"
}
finally {
    $pp.Quit()
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
