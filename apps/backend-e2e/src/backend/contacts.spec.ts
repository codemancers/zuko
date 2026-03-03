import axios from "axios";
import {
  createTestUserWithSession,
  deleteTestUser,
  getAuthCookie,
  cleanupTestUsers,
  type TestUser,
} from "../support/auth-helper";

interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  linkedinId?: string | null;
}

interface GetContactsResponse {
  contacts: Contact[];
}

describe("Contacts API", () => {
  let authCookie: string;
  let testUser: TestUser;

  beforeAll(async () => {
    // Create a test user with a valid session
    testUser = await createTestUserWithSession();
    authCookie = getAuthCookie(testUser.sessionToken);
  });

  afterAll(async () => {
    // Clean up test user
    await deleteTestUser(testUser.id);
    // Clean up any other test users that might have been created
    await cleanupTestUsers();
  });

  describe("POST /api/contacts", () => {
    it("should create a contact with all fields", async () => {
      const contactData = {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+14155552671",
        linkedinId: "johndoe",
        notes: "Met at tech conference",
        ownerIds: [testUser.id],
        primaryOwnerId: testUser.id,
      };

      const res = await axios.post("/api/contacts", contactData, {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        id: expect.any(Number),
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        linkedinId: contactData.linkedinId,
        notes: contactData.notes,
        isHidden: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(res.data.owners).toHaveLength(1);
      expect(res.data.owners[0]).toMatchObject({
        userId: testUser.id,
        isPrimary: true,
      });
    });

    it("should create a contact with only required fields (name and email)", async () => {
      const contactData = {
        name: "Jane Smith",
        email: "jane.smith@example.com",
        ownerIds: [testUser.id],
      };

      const res = await axios.post("/api/contacts", contactData, {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        id: expect.any(Number),
        name: contactData.name,
        email: contactData.email,
        phone: null,
        linkedinId: null,
        notes: null,
      });
    });

    it("should create a contact with phone only (no email)", async () => {
      const contactData = {
        name: "Bob Johnson",
        phone: "+14155552672",
        ownerIds: [testUser.id],
      };

      const res = await axios.post("/api/contacts", contactData, {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        name: contactData.name,
        phone: contactData.phone,
        email: null,
      });
    });

    it("should create a contact with LinkedIn ID only", async () => {
      const contactData = {
        name: "Alice Williams",
        linkedinId: "alicewilliams",
        ownerIds: [testUser.id],
      };

      const res = await axios.post("/api/contacts", contactData, {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        name: contactData.name,
        linkedinId: contactData.linkedinId,
        email: null,
        phone: null,
      });
    });

    it("should fail when no contact method is provided", async () => {
      const contactData = {
        name: "No Contact Method",
        ownerIds: [testUser.id],
      };

      await expect(
        axios.post("/api/contacts", contactData, {
          headers: { Cookie: authCookie },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 400,
          data: expect.objectContaining({
            message: expect.stringContaining(
              "At least one of email, phone, or linkedinId must be provided",
            ),
          }),
        }),
      });
    });

    it("should fail when phone is not in E.164 format", async () => {
      const contactData = {
        name: "Invalid Phone",
        phone: "1234567890", // Missing + prefix
        ownerIds: [testUser.id],
      };

      await expect(
        axios.post("/api/contacts", contactData, {
          headers: { 
            Cookie: authCookie 
          },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 400,
          data: expect.objectContaining({
            message: expect.stringContaining(
              "Phone number must be in E.164 format",
            ),
          }),
        }),
      });
    });

    it("should fail when no owner is assigned", async () => {
      const contactData = {
        name: "No Owner",
        email: "noowner@example.com",
        ownerIds: [],
      };

      await expect(
        axios.post("/api/contacts", contactData, {
          headers: { 
            Cookie: authCookie 
          },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 400,
          data: expect.objectContaining({
            message: expect.stringContaining(
              "At least one owner must be assigned",
            ),
          }),
        }),
      });
    });

    it("should fail when duplicate email is provided", async () => {
      const contactData = {
        name: "First Contact",
        email: "duplicate@example.com",
        ownerIds: [testUser.id],
      };

      // Create first contact
      await axios.post("/api/contacts", contactData, {
        headers: {
          Cookie: authCookie,
        },
      });

      // Try to create duplicate
      await expect(
        axios.post("/api/contacts", contactData, {
          headers: { 
            Cookie: authCookie 
          },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 400,
          data: expect.objectContaining({
            message: expect.stringContaining(
              "A contact with email duplicate@example.com already exists",
            ),
          }),
        }),
      });
    });

    it("should fail when not authenticated", async () => {
      const contactData = {
        name: "Unauthenticated",
        email: "unauth@example.com",
        ownerIds: [testUser.id],
      };

      await expect(
        axios.post("/api/contacts", contactData)
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 401,
        }),
      });
    });

    it("should create multiple contacts with different emails", async () => {
      const contacts = [
        {
          name: "Contact 1",
          email: "contact1@example.com",
          ownerIds: [testUser.id],
        },
        {
          name: "Contact 2",
          email: "contact2@example.com",
          ownerIds: [testUser.id],
        },
        {
          name: "Contact 3",
          email: "contact3@example.com",
          ownerIds: [testUser.id],
        },
      ];

      const results = await Promise.all(
        contacts.map((contact) =>
          axios.post("/api/contacts", contact, {
            headers: {
              Cookie: authCookie,
            },
          }),
        ),
      );

      results.forEach((res, index) => {
        expect(res.status).toBe(201);
        expect(res.data.email).toBe(contacts[index].email);
      });
    });
  });

  describe("GET /api/contacts", () => {
    it("should list all contacts", async () => {
      const res = await axios.get("/api/contacts", {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("contacts");
      expect(res.data).toHaveProperty("total");
      expect(res.data).toHaveProperty("page");
      expect(res.data).toHaveProperty("limit");
      expect(Array.isArray(res.data.contacts)).toBe(true);
    });

    it("should filter contacts by search term", async () => {
      const res = await axios.get<GetContactsResponse>("/api/contacts?search=john", {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(200);
      expect(
        res.data.contacts.every(
          (c) =>
            c.name.toLowerCase().includes("john") ||
            c.email?.toLowerCase().includes("john"),
        ),
      ).toBe(true);
    });

    it("should paginate contacts", async () => {
      const res = await axios.get("/api/contacts?page=1&limit=5", {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.page).toBe(1);
      expect(res.data.limit).toBe(5);
      expect(res.data.contacts.length).toBeLessThanOrEqual(5);
    });
  });

  describe("GET /api/contacts/:id", () => {
    it("should get a contact by ID", async () => {
      // Create a contact first
      const createRes = await axios.post(
        "/api/contacts",
        {
          name: "Get Test",
          email: "gettest@example.com",
          ownerIds: [testUser.id],
        },
        {
          headers: {
            Cookie: authCookie,
          },
        },
      );

      const contactId = createRes.data.id;

      const res = await axios.get(`/api/contacts/${contactId}`, {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.id).toBe(contactId);
      expect(res.data.name).toBe("Get Test");
    });

    it("should return 404 for non-existent contact", async () => {
      await expect(
        axios.get("/api/contacts/999999", {
          headers: {
            Cookie: authCookie,
          },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 404,
        }),
      });
    });
  });

  describe("PUT /api/contacts/:id", () => {
    it("should update a contact", async () => {
      // Create a contact first
      const createRes = await axios.post(
        "/api/contacts",
        {
          name: "Update Test",
          email: "updatetest@example.com",
          ownerIds: [testUser.id],
        },
        {
          headers: {
            Cookie: authCookie,
          },
        },
      );

      const contactId = createRes.data.id;

      const res = await axios.put(
        `/api/contacts/${contactId}`,
        {
          name: "Updated Name",
          phone: "+14155552673",
        },
        {
          headers: {
            Cookie: authCookie,
          },
        },
      );

      expect(res.status).toBe(200);
      expect(res.data.name).toBe("Updated Name");
      expect(res.data.phone).toBe("+14155552673");
      expect(res.data.email).toBe("updatetest@example.com"); // Should remain unchanged
    });
  });

  describe("DELETE /api/contacts/:id", () => {
    it("should hide (soft delete) a contact", async () => {
      // Create a contact first
      const createRes = await axios.post(
        "/api/contacts",
        {
          name: "Delete Test",
          email: "deletetest@example.com",
          ownerIds: [testUser.id],
        },
        {
          headers: {
            Cookie: authCookie,
          },
        },
      );

      const contactId = createRes.data.id;

      const res = await axios.delete(`/api/contacts/${contactId}`, {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(res.status).toBe(204);

      // Verify contact is hidden
      const getRes = await axios.get(`/api/contacts/${contactId}`, {
        headers: {
          Cookie: authCookie,
        },
      });

      expect(getRes.data.isHidden).toBe(true);
    });
  });
});
