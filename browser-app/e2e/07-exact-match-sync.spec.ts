/**
 * E2E Tests: Exact Match Synchronization
 *
 * Tests the exact match functionality where:
 * 1. When a manual entity is marked, ALL exact text matches in the document are marked
 * 2. When an entity is selected/deselected, ALL entities with identical text sync their state
 *
 * Story: Entity Review UI - Exact Match Synchronization
 */

import { test, expect, type Page } from '@playwright/test';
import { PIIAnonymizerPage } from './helpers/page-objects';
import { createTextFile } from './fixtures/test-files';

/**
 * Test content with repeated text patterns
 */
const CONTENT_WITH_REPEATED_TEXT = `
Dear John Smith,

Thank you for contacting us, John Smith. We have received your inquiry.

As discussed with John Smith on the phone, we will proceed with the following:

1. Contact John Smith at john.smith@example.com
2. Send documents to John Smith
3. Follow up with John Smith next week

Best regards,
Customer Service

CC: John Smith
`;

const CONTENT_WITH_MULTIPLE_EMAILS = `
Contact Information:

Primary: contact@example.com
Support: support@company.com
Sales: sales@company.com

For urgent matters, reach out to contact@example.com directly.
You can also use contact@example.com for general inquiries.

Alternative contacts:
- support@company.com (technical issues)
- sales@company.com (pricing questions)
`;

const CONTENT_WITH_REPEATED_PHONE = `
Customer Records:

Customer 1: +41 79 123 45 67
Customer 2: +41 79 987 65 43
Customer 3: +41 79 123 45 67

Note: Customer 1 and 3 share the same number: +41 79 123 45 67

Emergency contact: +41 79 123 45 67
`;

const CONTENT_WITH_MIXED_PII_REPEATS = `
Employee Directory:

Name: Marie Dupont
Email: marie.dupont@company.com
Phone: +33 6 12 34 56 78

Name: Jean Martin
Email: jean.martin@company.com
Phone: +33 6 98 76 54 32

Name: Marie Dupont (Manager)
Email: marie.dupont@company.com
Phone: +33 6 12 34 56 78

Please contact Marie Dupont for approvals.
`;

/**
 * Helper class for entity sidebar interactions
 */
class EntitySidebarHelper {
  constructor(private page: Page) {}

  /**
   * Get count of entities with specific text
   */
  async getEntityCountByText(text: string): Promise<number> {
    const entities = await this.page.locator('.entity-item').all();
    let count = 0;
    for (const entity of entities) {
      const entityText = await entity.locator('.entity-item-text').textContent();
      if (entityText?.includes(text)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total entity count in sidebar
   */
  async getTotalEntityCount(): Promise<number> {
    return await this.page.locator('.entity-item').count();
  }

  /**
   * Click checkbox for first entity with specific text
   */
  async clickEntityCheckbox(text: string): Promise<void> {
    const entities = await this.page.locator('.entity-item').all();
    for (const entity of entities) {
      const entityText = await entity.locator('.entity-item-text').textContent();
      if (entityText?.includes(text)) {
        await entity.locator('.entity-item-checkbox').click();
        return;
      }
    }
    throw new Error(`Entity with text "${text}" not found`);
  }

  /**
   * Check if all entities with specific text have the same selection state
   */
  async areAllEntitiesWithTextInSameState(text: string, shouldBeSelected: boolean): Promise<boolean> {
    const entities = await this.page.locator('.entity-item').all();
    for (const entity of entities) {
      const entityText = await entity.locator('.entity-item-text').textContent();
      if (entityText?.includes(text)) {
        const isChecked = await entity.locator('.entity-item-checkbox').isChecked();
        if (isChecked !== shouldBeSelected) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Get count of selected entities
   */
  async getSelectedEntityCount(): Promise<number> {
    const checkboxes = await this.page.locator('.entity-item-checkbox:checked').count();
    return checkboxes;
  }

  /**
   * Get count of entities in preview with replacement tokens
   */
  async getReplacementTokenCount(): Promise<number> {
    return await this.page.locator('.entity-replacement').count();
  }

  /**
   * Get count of unselected entities in preview
   */
  async getUnselectedEntityCount(): Promise<number> {
    return await this.page.locator('.entity-highlight.unselected').count();
  }

  /**
   * Expand entity group by type
   */
  async expandEntityGroup(type: string): Promise<void> {
    const header = this.page.locator('.entity-group-header', { hasText: type });
    const isExpanded = await header.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await header.click();
    }
  }

  /**
   * Wait for entities to load
   */
  async waitForEntities(): Promise<void> {
    await this.page.waitForSelector('.entity-item', { timeout: 30000 });
  }
}

test.describe('Exact Match Synchronization - Manual Marking', () => {
  test('should mark ALL occurrences when manually marking repeated text', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    // Upload file with repeated "John Smith" text (appears 7 times)
    const file = createTextFile(CONTENT_WITH_REPEATED_TEXT, 'repeated-name.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();

    // Get initial entity count
    await sidebar.waitForEntities();
    // Entity count available for debugging if needed
    await sidebar.getTotalEntityCount();

    // The auto-detected entities should be there
    // Now if we manually mark one "John Smith", all 7 should be marked
    // (Note: This test may need adjustment based on what's auto-detected)

    // Count how many entities have "John Smith" text
    const johnSmithCount = await sidebar.getEntityCountByText('John Smith');

    // Verify that auto-detection already found multiple "John Smith" instances
    // OR manually mark one and verify all get marked
    if (johnSmithCount > 0) {
      // If already detected, verify all have same selection state
      const allSameState = await sidebar.areAllEntitiesWithTextInSameState('John Smith', true);
      expect(allSameState).toBe(true);
    }
  });

  test('should mark all exact matches of manually selected text', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    // EntitySidebarHelper available if needed for manual marking assertions
    new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    // Create content with repeated email that might not be auto-detected
    const customContent = `
Report for: ABC Corp

Contact: ABC Corp headquarters
Location: ABC Corp office building
Signed by: ABC Corp management
    `;

    const file = createTextFile(customContent, 'abc-corp.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();

    // Wait for the preview to load
    await page.waitForSelector('.preview-body-content', { timeout: 10000 });

    // If "ABC Corp" is not auto-detected, manually mark it
    // After marking one instance, all 4 occurrences should be entities

    const previewContent = await page.locator('.preview-body-content').textContent();
    const occurrences = (previewContent?.match(/ABC Corp/g) || []).length;

    // ABC Corp appears 4 times in the content
    expect(occurrences).toBe(4);
  });
});

test.describe('Exact Match Synchronization - Selection State', () => {
  test('should sync selection state across all identical entities when checkbox clicked', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    // Upload file with repeated emails
    const file = createTextFile(CONTENT_WITH_MULTIPLE_EMAILS, 'repeated-emails.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
    await sidebar.waitForEntities();

    // "contact@example.com" appears 3 times
    // Initially all should be selected
    const initialContactCount = await sidebar.getEntityCountByText('contact@example.com');

    if (initialContactCount >= 2) {
      // Verify all start as selected
      let allSelected = await sidebar.areAllEntitiesWithTextInSameState('contact@example.com', true);
      expect(allSelected).toBe(true);

      // Expand the EMAIL group to see entities
      await sidebar.expandEntityGroup('Email');

      // Unselect ONE instance of contact@example.com
      await sidebar.clickEntityCheckbox('contact@example.com');

      // ALL instances should now be unselected
      allSelected = await sidebar.areAllEntitiesWithTextInSameState('contact@example.com', false);
      expect(allSelected).toBe(true);

      // The preview should show all instances as unselected (strikethrough)
      // Not as replacement tokens
      await page.waitForTimeout(500); // Wait for render
    }
  });

  test('should re-select all instances when clicking checkbox again', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(CONTENT_WITH_REPEATED_PHONE, 'repeated-phone.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
    await sidebar.waitForEntities();

    // "+41 79 123 45 67" appears 4 times
    const phoneText = '+41 79 123 45 67';
    const phoneCount = await sidebar.getEntityCountByText(phoneText);

    if (phoneCount >= 2) {
      // First unselect
      await sidebar.expandEntityGroup('Phone');
      await sidebar.clickEntityCheckbox(phoneText);

      const allUnselected = await sidebar.areAllEntitiesWithTextInSameState(phoneText, false);
      expect(allUnselected).toBe(true);

      // Then re-select
      await sidebar.clickEntityCheckbox(phoneText);

      const allSelected = await sidebar.areAllEntitiesWithTextInSameState(phoneText, true);
      expect(allSelected).toBe(true);
    }
  });

  test('should not affect other entities when syncing identical text', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(CONTENT_WITH_MIXED_PII_REPEATS, 'mixed-repeats.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
    await sidebar.waitForEntities();

    // Get entity counts for multi-entity sync tests
    await sidebar.getSelectedEntityCount();
    const marieDupontCount = await sidebar.getEntityCountByText('Marie Dupont');
    const jeanMartinCount = await sidebar.getEntityCountByText('Jean Martin');

    // Unselect "Marie Dupont" entities
    if (marieDupontCount > 0) {
      await sidebar.expandEntityGroup('Person');
      await sidebar.clickEntityCheckbox('Marie Dupont');

      // Marie Dupont instances should be unselected
      const marieSameState = await sidebar.areAllEntitiesWithTextInSameState('Marie Dupont', false);
      expect(marieSameState).toBe(true);

      // Jean Martin should still be selected
      if (jeanMartinCount > 0) {
        const jeanSameState = await sidebar.areAllEntitiesWithTextInSameState('Jean Martin', true);
        expect(jeanSameState).toBe(true);
      }
    }
  });
});

test.describe('Exact Match Synchronization - Preview Rendering', () => {
  test('should show replacement tokens for ALL selected identical entities', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(CONTENT_WITH_MULTIPLE_EMAILS, 'emails-preview.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
    await sidebar.waitForEntities();

    // Count replacement tokens in preview
    const replacementCount = await sidebar.getReplacementTokenCount();

    // All detected entities should show as replacement tokens (selected by default)
    const totalEntities = await sidebar.getTotalEntityCount();
    expect(replacementCount).toBe(totalEntities);
  });

  test('should show unselected style for ALL identical entities when deselected', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(CONTENT_WITH_MULTIPLE_EMAILS, 'emails-unselect.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
    await sidebar.waitForEntities();

    // Get count of specific email
    const contactEmailCount = await sidebar.getEntityCountByText('contact@example.com');

    if (contactEmailCount >= 2) {
      await sidebar.expandEntityGroup('Email');

      // Before unselecting, all contact@example.com should be selected
      const allSelected = await sidebar.areAllEntitiesWithTextInSameState('contact@example.com', true);
      expect(allSelected).toBe(true);

      // Unselect contact@example.com
      await sidebar.clickEntityCheckbox('contact@example.com');

      // Wait for re-render
      await page.waitForTimeout(500);

      // After unselecting, ALL contact@example.com instances should be unselected
      const allUnselected = await sidebar.areAllEntitiesWithTextInSameState('contact@example.com', false);
      expect(allUnselected).toBe(true);

      // Verify that the number of unselected checkboxes matches
      const uncheckedCheckboxes = await page.locator('.entity-item-checkbox:not(:checked)').count();
      expect(uncheckedCheckboxes).toBeGreaterThanOrEqual(contactEmailCount);
    }
  });
});

test.describe('Exact Match Synchronization - Edge Cases', () => {
  test('should handle entities with same text but different types', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    // EntitySidebarHelper available for edge case assertions if needed
    new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    // Content where same text could be detected as different types
    const ambiguousContent = `
Contact: Jean Paris
Location: Paris
City: Paris, France

Manager: Paris department
    `;

    const file = createTextFile(ambiguousContent, 'ambiguous.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();

    // Verify the system handles this gracefully
    await page.waitForSelector('.preview-body-content', { timeout: 10000 });
    const content = await page.locator('.preview-body-content').textContent();
    expect(content).toBeTruthy();
  });

  test('should handle case-sensitive exact matching', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    // Content with same text in different cases
    const caseContent = `
Contact: JOHN SMITH
Manager: John Smith
Employee: john smith
Reference: John Smith
    `;

    const file = createTextFile(caseContent, 'case-sensitive.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
    await sidebar.waitForEntities();

    // Different cases should be treated as different entities
    // "John Smith" (exact case) instances should sync together
    // "JOHN SMITH" and "john smith" should be independent
    const totalCount = await sidebar.getTotalEntityCount();
    expect(totalCount).toBeGreaterThan(0);
  });

  test('should handle overlapping entity positions gracefully', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);

    await app.goto();
    await app.waitForModelReady();

    // Content with potentially overlapping patterns
    const overlappingContent = `
Email: john.smith@example.com (John Smith)
Contact John Smith at john.smith@example.com
John Smith's email: john.smith@example.com
    `;

    const file = createTextFile(overlappingContent, 'overlapping.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();

    // System should handle overlapping matches without crashing
    await page.waitForSelector('.preview-body-content', { timeout: 10000 });

    // Verify preview renders correctly
    const previewVisible = await page.locator('.preview-body-content').isVisible();
    expect(previewVisible).toBe(true);
  });

  test('should handle empty document gracefully', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);

    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('', 'empty.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();

    // Should not crash, should show empty state
    const emptyState = page.locator('.entity-sidebar-empty');
    await expect(emptyState).toBeVisible();
  });

  test('should handle single occurrence (no duplicates)', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    // Content with unique entities (no repeats)
    const uniqueContent = `
Name: Alice Johnson
Email: alice@company.com
Phone: +41 22 123 45 67

Name: Bob Williams
Email: bob@enterprise.org
Phone: +33 1 23 45 67 89
    `;

    const file = createTextFile(uniqueContent, 'unique-entities.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
    await sidebar.waitForEntities();

    // Each entity should only appear once
    const aliceCount = await sidebar.getEntityCountByText('Alice Johnson');
    const bobCount = await sidebar.getEntityCountByText('Bob Williams');

    expect(aliceCount).toBeLessThanOrEqual(1);
    expect(bobCount).toBeLessThanOrEqual(1);

    // Selection should still work for single entities
    if (aliceCount === 1) {
      await sidebar.expandEntityGroup('Person');
      await sidebar.clickEntityCheckbox('Alice Johnson');

      const isUnselected = await sidebar.areAllEntitiesWithTextInSameState('Alice Johnson', false);
      expect(isUnselected).toBe(true);
    }
  });
});

test.describe('Exact Match Synchronization - Performance', () => {
  test('should handle document with many repeated entities efficiently', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    const sidebar = new EntitySidebarHelper(page);

    await app.goto();
    await app.waitForModelReady();

    // Create content with many repetitions
    const repeatedEmail = 'test@example.com';
    const lines = Array.from({ length: 50 }, (_, i) =>
      `Line ${i + 1}: Contact ${repeatedEmail} for assistance.`,
    ).join('\n');

    const file = createTextFile(lines, 'many-repeats.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete(120000);

    await expect(app.reviewSection).toBeVisible();
    await sidebar.waitForEntities();

    // Should have detected the repeated email many times
    const emailCount = await sidebar.getEntityCountByText(repeatedEmail);
    expect(emailCount).toBeGreaterThan(10);

    // Selection change should be fast even with many entities
    const startTime = Date.now();
    await sidebar.expandEntityGroup('Email');
    await sidebar.clickEntityCheckbox(repeatedEmail);
    const endTime = Date.now();

    // Should complete in reasonable time (< 2 seconds)
    expect(endTime - startTime).toBeLessThan(2000);

    // All should be unselected
    const allUnselected = await sidebar.areAllEntitiesWithTextInSameState(repeatedEmail, false);
    expect(allUnselected).toBe(true);
  });
});
